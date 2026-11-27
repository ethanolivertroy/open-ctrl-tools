import { useCallback, useEffect, useState } from 'react';
import {
  getDefaultProvider,
  getProviderConfig,
  hasAnyProvider,
  migrateApiKeyToProviderConfig,
} from '@/lib/storage/provider-store';
import type { ProviderId } from '@/lib/ai/providers';

interface UseAIProviderStateOptions {
  initialHasProvider?: boolean | null;
  initialProvider?: ProviderId;
  loadActiveModel?: boolean;
}

export function useAIProviderState({
  initialHasProvider = false,
  initialProvider = 'anthropic',
  loadActiveModel = false,
}: UseAIProviderStateOptions = {}) {
  const [hasProvider, setHasProvider] = useState<boolean | null>(initialHasProvider);
  const [activeProvider, setActiveProvider] = useState<ProviderId>(initialProvider);
  const [activeModel, setActiveModel] = useState('');
  const [isVaultOpen, setIsVaultOpen] = useState(false);

  const refreshProviderState = useCallback(async () => {
    await migrateApiKeyToProviderConfig();

    const anyProvider = await hasAnyProvider();
    setHasProvider(anyProvider);

    const providerId = await getDefaultProvider();
    if (!providerId) {
      if (loadActiveModel) {
        setActiveModel('');
      }
      return;
    }

    setActiveProvider(providerId);

    if (!loadActiveModel) return;

    const config = await getProviderConfig(providerId);
    setActiveModel(config?.model || '');
  }, [loadActiveModel]);

  useEffect(() => {
    void refreshProviderState();
  }, [refreshProviderState]);

  return {
    hasProvider,
    setHasProvider,
    activeProvider,
    setActiveProvider,
    activeModel,
    setActiveModel,
    isVaultOpen,
    setIsVaultOpen,
    refreshProviderState,
  };
}
