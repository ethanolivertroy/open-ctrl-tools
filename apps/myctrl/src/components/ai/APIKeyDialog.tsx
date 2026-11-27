/**
 * Legacy APIKeyDialog compatibility layer.
 *
 * The product now supports multiple AI providers, but older code still imports
 * APIKeyDialog/APIKeyPrompt. Keep those exports stable while routing the actual
 * configuration flow through the shared provider setup surface.
 */

import { useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Key } from 'lucide-react';
import { ProviderVault } from './ProviderVault';

interface APIKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyConfigured?: () => void;
}

export function APIKeyDialog({
  isOpen,
  onClose,
  onKeyConfigured,
}: APIKeyDialogProps) {
  return (
    <ProviderVault
      isOpen={isOpen}
      onClose={onClose}
      onProvidersChanged={onKeyConfigured}
    />
  );
}

/**
 * Hook to manage API key dialog state.
 */
export function useAPIKeyDialog() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    open,
    close,
  };
}

/**
 * Prompt component shown when no AI provider is configured.
 */
interface APIKeyPromptProps {
  onOpenSettings: () => void;
  compact?: boolean;
}

export function APIKeyPrompt({
  onOpenSettings,
  compact = false,
}: APIKeyPromptProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
        <Key className="w-4 h-4 text-amber-500 shrink-0" />
        <p className="text-sm text-muted-foreground flex-1">
          Configure an AI provider to use workbenches and GRCLanker.
        </p>
        <button
          onClick={onOpenSettings}
          className="px-3 py-1 text-sm font-medium text-primary hover:underline"
        >
          Set Up AI
        </button>
      </div>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Key className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">AI Provider Required</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Set up a cloud or local AI provider to use generative views,
              GRCLanker, and assessment workbenches. Provider credentials stay
              local to your browser.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onOpenSettings}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Configure AI Provider
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default APIKeyDialog;
