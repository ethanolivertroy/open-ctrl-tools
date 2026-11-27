import { describe, expect, it, vi } from 'vitest';
import { resolveProviderExecution } from '@/lib/services/provider-runtime';
import type { ProviderConfigRecord } from '@/lib/storage-types';

vi.mock('@/lib/storage/provider-store', () => ({
  getProviderConfig: vi.fn(),
  getLegacyStoredApiKey: vi.fn(),
  setProviderConfig: vi.fn(),
}));

vi.mock('@/lib/services/xai-oauth-session', () => ({
  resolveStoredGrokCredential: vi.fn(),
}));

import { getLegacyStoredApiKey, getProviderConfig } from '@/lib/storage/provider-store';
import { resolveStoredGrokCredential } from '@/lib/services/xai-oauth-session';

describe('provider runtime', () => {
  it('prefers the configured provider api key over any legacy key', async () => {
    const providerConfig: ProviderConfigRecord = {
      providerId: 'grok',
      apiKey: 'xai-live-key',
      model: 'grok-4.5',
      isDefault: false,
      updatedAt: Date.now(),
    };
    vi.mocked(getProviderConfig).mockResolvedValueOnce(providerConfig);
    vi.mocked(getLegacyStoredApiKey).mockResolvedValueOnce('sk-ant-legacy');

    const execution = await resolveProviderExecution({
      providerId: 'grok',
      includeApiKey: true,
    });

    expect(execution.apiKey).toBe('xai-live-key');
  });

  it('uses a matching legacy key for the requested provider', async () => {
    vi.mocked(getProviderConfig).mockResolvedValueOnce(null);
    vi.mocked(getLegacyStoredApiKey).mockResolvedValueOnce('sk-ant-legacy');

    const execution = await resolveProviderExecution({
      providerId: 'anthropic',
      includeApiKey: true,
    });

    expect(execution.apiKey).toBe('sk-ant-legacy');
  });

  it('ignores a legacy key when it belongs to a different provider', async () => {
    vi.mocked(getProviderConfig).mockResolvedValueOnce(null);
    vi.mocked(getLegacyStoredApiKey).mockResolvedValueOnce('sk-ant-legacy');

    const execution = await resolveProviderExecution({
      providerId: 'grok',
      includeApiKey: true,
    });

    expect(execution.apiKey).toBeUndefined();
  });

  it('falls back to the provider default when the stored model is retired', async () => {
    const providerConfig: ProviderConfigRecord = {
      providerId: 'openai',
      apiKey: 'sk-live-key',
      model: 'gpt-4o', // retired — no longer in the catalog
      isDefault: false,
      updatedAt: Date.now(),
    };
    vi.mocked(getProviderConfig).mockResolvedValueOnce(providerConfig);

    const execution = await resolveProviderExecution({ providerId: 'openai' });

    expect(execution.model).toBe('gpt-5.6-terra');
  });

  it('keeps a stored model that still exists in the catalog', async () => {
    const providerConfig: ProviderConfigRecord = {
      providerId: 'anthropic',
      apiKey: 'sk-ant-live-key',
      model: 'claude-haiku-4-5',
      isDefault: false,
      updatedAt: Date.now(),
    };
    vi.mocked(getProviderConfig).mockResolvedValueOnce(providerConfig);

    const execution = await resolveProviderExecution({ providerId: 'anthropic' });

    expect(execution.model).toBe('claude-haiku-4-5');
  });

  it('uses an X Premium oauth token for grok when no api key is stored', async () => {
    const providerConfig: ProviderConfigRecord = {
      providerId: 'grok',
      authType: 'oauth',
      oauth: {
        accessToken: 'stale-access',
        refreshToken: 'refresh-1',
        expiresAt: Date.now() - 1,
      },
      model: 'grok-4.5',
      isDefault: true,
      updatedAt: Date.now(),
    };
    vi.mocked(getProviderConfig).mockResolvedValueOnce(providerConfig);
    vi.mocked(resolveStoredGrokCredential).mockResolvedValueOnce('fresh-oauth-access');

    const execution = await resolveProviderExecution({
      providerId: 'grok',
      includeApiKey: true,
    });

    expect(execution.apiKey).toBe('fresh-oauth-access');
    expect(resolveStoredGrokCredential).toHaveBeenCalledWith(providerConfig, undefined);
  });

  it('keeps dynamic-catalog models (ollama) even when not in the registry', async () => {
    const providerConfig: ProviderConfigRecord = {
      providerId: 'ollama',
      model: 'qwen3:8b',
      isDefault: false,
      updatedAt: Date.now(),
    };
    vi.mocked(getProviderConfig).mockResolvedValueOnce(providerConfig);

    const execution = await resolveProviderExecution({ providerId: 'ollama' });

    expect(execution.model).toBe('qwen3:8b');
  });
});
