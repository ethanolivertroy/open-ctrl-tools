import * as React from 'react';
import {
  consumePendingAISettingsRequest,
  hasPendingAIChatRequest,
  hasPendingAISettingsRequest,
  OPEN_AI_CHAT_EVENT,
  OPEN_AI_SETTINGS_EVENT,
} from '@/lib/ai-chat-events';

type DockComponent = typeof import('./GrcLankerDock')['GrcLankerDock'];
type VaultComponent = typeof import('./ProviderVault')['ProviderVault'];

interface GrcLankerDockLoaderProps {
  frameworkId?: string;
  controlSlug?: string;
  controlTitle?: string;
  assessmentQuestions?: string[];
}

export function GrcLankerDockLoader({
  frameworkId,
  controlSlug,
  controlTitle,
  assessmentQuestions,
}: GrcLankerDockLoaderProps) {
  const [Dock, setDock] = React.useState<DockComponent | null>(null);
  const [Vault, setVault] = React.useState<VaultComponent | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [initialSettingsOpen, setInitialSettingsOpen] = React.useState(false);
  const mountedRef = React.useRef(true);
  const dockRequestedRef = React.useRef(false);

  React.useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const loadDock = React.useCallback(() => {
    dockRequestedRef.current = true;
    return import('./GrcLankerDock')
      .then((module) => {
        if (mountedRef.current) setDock(() => module.GrcLankerDock);
        return module.GrcLankerDock;
      })
      .catch((error) => {
        dockRequestedRef.current = false;
        console.error('GRCLanker dock failed to load:', error);
        throw error;
      });
  }, []);

  const loadVault = React.useCallback(() => {
    return import('./ProviderVault')
      .then((module) => {
        if (mountedRef.current) setVault(() => module.ProviderVault);
        return module.ProviderVault;
      })
      .catch((error) => {
        console.error('Provider vault failed to load:', error);
        throw error;
      });
  }, []);

  React.useEffect(() => {
    // The pending flags are recorded by requestOpenAIChat/requestOpenAISettings
    // before dispatch; the dock consumes them once it mounts.
    const openChat = () => {
      setSettingsOpen(false);
      void loadDock();
    };

    const openSettings = () => {
      if (dockRequestedRef.current) {
        setInitialSettingsOpen(true);
        void loadDock();
        return;
      }
      // The vault handles this request directly, so consume the pending flag
      // before the dock can double-open settings later.
      consumePendingAISettingsRequest();
      setSettingsOpen(true);
      void loadVault();
    };

    document.addEventListener(OPEN_AI_CHAT_EVENT, openChat);
    document.addEventListener(OPEN_AI_SETTINGS_EVENT, openSettings);

    if (hasPendingAIChatRequest()) void loadDock();
    if (hasPendingAISettingsRequest()) openSettings();

    return () => {
      document.removeEventListener(OPEN_AI_CHAT_EVENT, openChat);
      document.removeEventListener(OPEN_AI_SETTINGS_EVENT, openSettings);
    };
  }, [loadDock, loadVault]);

  return (
    <>
      {Dock ? (
        <Dock
          frameworkId={frameworkId}
          controlSlug={controlSlug}
          controlTitle={controlTitle}
          assessmentQuestions={assessmentQuestions}
          initialSettingsOpen={initialSettingsOpen}
        />
      ) : null}
      {Vault ? (
        <Vault isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      ) : null}
    </>
  );
}
