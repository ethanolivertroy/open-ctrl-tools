import { refreshXaiOAuth, xaiAccessTokenIsFresh } from '@/lib/ai/xai-oauth';
import { getProviderConfig, setProviderConfig } from '@/lib/storage/provider-store';
import type { ProviderConfigRecord } from '@/lib/storage-types';

export async function ensureFreshXaiAccessToken(
  config: ProviderConfigRecord,
): Promise<string> {
  const oauth = config.oauth;
  if (!oauth?.refreshToken) {
    throw new Error('No SuperGrok / X Premium session is saved.');
  }

  if (xaiAccessTokenIsFresh(oauth)) {
    return oauth.accessToken;
  }

  const tokens = await refreshXaiOAuth(oauth.refreshToken);
  await setProviderConfig({
    providerId: config.providerId,
    apiKey: config.apiKey,
    authType: 'oauth',
    oauth: tokens,
    model: config.model,
    baseUrl: config.baseUrl,
    isDefault: config.isDefault,
  });
  return tokens.accessToken;
}

export async function resolveStoredGrokCredential(
  config: ProviderConfigRecord | null,
  fallbackApiKey?: string,
): Promise<string | undefined> {
  if (config?.oauth?.refreshToken) {
    return ensureFreshXaiAccessToken(config);
  }
  return config?.apiKey || fallbackApiKey || undefined;
}

export async function resolveGrokCredentialForProvider(
  fallbackApiKey?: string,
): Promise<string | undefined> {
  const config = await getProviderConfig('grok');
  return resolveStoredGrokCredential(config, fallbackApiKey);
}
