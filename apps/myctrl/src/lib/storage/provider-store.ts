import { getDb, type ProviderConfigRecord } from '../db';
import {
  detectProviderFromKey,
  isSupportedProviderId,
  PROVIDERS,
  type ProviderId,
} from '../ai/providers';
import type { MyCtrlDB } from '../db-runtime';

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

type RawProviderConfigRecord = Omit<ProviderConfigRecord, 'providerId'> & {
  providerId: string;
};

function isSupportedProviderConfig(config: RawProviderConfigRecord): config is ProviderConfigRecord {
  return isSupportedProviderId(config.providerId);
}

async function loadSupportedProviderConfigs(db: MyCtrlDB): Promise<ProviderConfigRecord[]> {
  const configs = await db.providerConfigs.toArray() as RawProviderConfigRecord[];
  const supported = configs.filter(isSupportedProviderConfig);
  const unsupported = configs.filter(config => !isSupportedProviderConfig(config));

  if (unsupported.length > 0) {
    await Promise.all(unsupported.map(config => db.providerConfigs.delete(config.providerId)));
  }

  return supported;
}

// === API Key Storage (BYOK) — Legacy single-key interface ===
// These functions are kept for backwards compatibility.
// New code should use the provider config functions below.

export async function getStoredApiKey(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openDb();
    const defaultProvider = await getDefaultProvider();
    if (defaultProvider) {
      const config = await getProviderConfig(defaultProvider);
      if (config?.apiKey) return config.apiKey;
    }

    const setting = await db.settings.get('api-key');
    return setting?.value || null;
  } catch {
    return null;
  }
}

export async function getLegacyStoredApiKey(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openDb();
    const setting = await db.settings.get('api-key');
    return setting?.value || null;
  } catch {
    return null;
  }
}

export async function setStoredApiKey(key: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.settings.put({ key: 'api-key', value: key });
}

export async function clearStoredApiKey(): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.settings.delete('api-key');
}

export async function hasStoredApiKey(): Promise<boolean> {
  return (await getStoredApiKey()) !== null;
}

// === Provider Config Storage (Multi-Provider) ===

export async function getProviderConfig(providerId: ProviderId): Promise<ProviderConfigRecord | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openDb();
    const config = await db.providerConfigs.get(providerId);
    return config || null;
  } catch {
    return null;
  }
}

export async function setProviderConfig(config: Omit<ProviderConfigRecord, 'updatedAt'>): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.providerConfigs.put({
    ...config,
    updatedAt: Date.now(),
  });
}

export async function deleteProviderConfig(providerId: ProviderId): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.providerConfigs.delete(providerId);
}

export async function getEnabledProviders(): Promise<ProviderConfigRecord[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDb();
    return await loadSupportedProviderConfigs(db);
  } catch {
    return [];
  }
}

export async function getDefaultProvider(): Promise<ProviderId | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openDb();
    const configs = await loadSupportedProviderConfigs(db);
    const defaultConfig = configs.find(config => config.isDefault);
    if (defaultConfig) return defaultConfig.providerId;
    if (configs.length > 0) return configs[0].providerId;
    return null;
  } catch {
    return null;
  }
}

export async function setDefaultProvider(providerId: ProviderId): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.transaction('rw', db.providerConfigs, async () => {
    const all = await db.providerConfigs.toArray();
    for (const config of all) {
      if (config.isDefault && config.providerId !== providerId) {
        await db.providerConfigs.update(config.providerId, { isDefault: false });
      }
    }

    const target = await db.providerConfigs.get(providerId);
    if (target) {
      await db.providerConfigs.update(providerId, { isDefault: true });
    }
  });
}

export async function hasAnyProvider(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const db = await openDb();
    const configs = await loadSupportedProviderConfigs(db);
    if (configs.length > 0) return true;

    const legacyKey = await db.settings.get('api-key');
    return !!legacyKey?.value;
  } catch {
    return false;
  }
}

/**
 * Migrate legacy single API key to the new provider config system.
 * Called once — checks if migration already happened.
 */
export async function migrateApiKeyToProviderConfig(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDb();
    const migrated = await db.settings.get('provider-config-migrated');
    if (migrated) return;

    const legacyKey = await db.settings.get('api-key');
    if (legacyKey?.value) {
      const detectedProvider = detectProviderFromKey(legacyKey.value) || 'anthropic';
      const providerInfo = PROVIDERS[detectedProvider];

      await db.providerConfigs.put({
        providerId: detectedProvider,
        apiKey: legacyKey.value,
        model: providerInfo.defaultModel,
        isDefault: true,
        updatedAt: Date.now(),
      });
    }

    await db.settings.put({ key: 'provider-config-migrated', value: 'true' });
  } catch (error) {
    console.error('Provider config migration failed:', error);
  }
}
