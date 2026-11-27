import { useCallback, useEffect, useState } from 'react';
import type { ProviderId } from '@/lib/ai/providers';
import {
  getDefaultProvider,
  getEnabledProviders,
  migrateApiKeyToProviderConfig,
  setDefaultProvider,
} from '@/lib/storage/provider-store';
import type { ProviderConfigRecord } from '@/lib/storage-types';

interface UseConfiguredProvidersOptions {
  autoLoad?: boolean;
}

export function useConfiguredProviders({
  autoLoad = true,
}: UseConfiguredProvidersOptions = {}) {
  const [enabledProviders, setEnabledProviders] = useState<ProviderConfigRecord[]>([]);
  const [defaultProviderId, setDefaultProviderId] = useState<ProviderId | null>(null);

  const loadProviders = useCallback(async () => {
    await migrateApiKeyToProviderConfig();
    const [enabled, defaultId] = await Promise.all([
      getEnabledProviders(),
      getDefaultProvider(),
    ]);
    setEnabledProviders(enabled);
    setDefaultProviderId(defaultId);
  }, []);

  useEffect(() => {
    if (!autoLoad) return;
    void loadProviders();
  }, [autoLoad, loadProviders]);

  const selectDefaultProvider = useCallback(async (providerId: ProviderId) => {
    await setDefaultProvider(providerId);
    setDefaultProviderId(providerId);
  }, []);

  return {
    enabledProviders,
    defaultProviderId,
    loadProviders,
    selectDefaultProvider,
  };
}
