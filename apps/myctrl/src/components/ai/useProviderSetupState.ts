import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { PROVIDERS, resolveStoredModelId, type ProviderId } from '@/lib/ai/providers';
import type { TransformersProgress } from '@/lib/ai/transformers-client';
import type { WebLLMProgress } from '@/lib/ai/webllm-client';
import { resolveStoredGrokCredential } from '@/lib/services/xai-oauth-session';
import { streamServerProviderResponse } from '@/lib/services/server-provider-client';
import {
  deleteProviderConfig,
  getProviderConfig,
  setProviderConfig,
} from '@/lib/storage/provider-store';
import type { ProviderOAuthTokens } from '@/lib/storage-types';
import { useXaiDeviceOAuth } from './useXaiDeviceOAuth';

export type ProviderSetupTestStatus = 'idle' | 'testing' | 'success' | 'error';
export type { XaiOAuthUiStatus } from './useXaiDeviceOAuth';

interface UseProviderSetupStateOptions {
  providerId: ProviderId;
  isOpen: boolean;
  onClose: () => void;
  onConfigured?: () => void;
}

type ProviderModelOption = {
  id: string;
  name: string;
};

async function getStoredProviderKey(
  providerId: ProviderId,
  apiKey: string,
  maskedKey: boolean,
): Promise<string> {
  if (!maskedKey && apiKey) return apiKey;
  const existing = await getProviderConfig(providerId);
  if (providerId === 'grok') {
    return (await resolveStoredGrokCredential(existing, undefined)) || '';
  }
  return existing?.apiKey || '';
}

async function loadOllamaModelOptions(baseUrl: string): Promise<ProviderModelOption[]> {
  const { listOllamaModels } = await import('@/lib/ai/ollama-client');
  const models = await listOllamaModels(baseUrl);
  return models.map((model) => ({ id: model.name, name: model.name }));
}

async function loadChromeAIAvailability() {
  const { getChromeAIStatus } = await import('@/lib/ai/chrome-ai-client');
  return getChromeAIStatus();
}

export function useProviderSetupState({
  providerId,
  isOpen,
  onClose,
  onConfigured,
}: UseProviderSetupStateOptions) {
  const provider = PROVIDERS[providerId];
  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(provider.defaultModel);
  const [baseUrl, setBaseUrl] = useState('');
  const [testStatus, setTestStatus] = useState<ProviderSetupTestStatus>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<ProviderModelOption[]>([]);
  const [downloadStatus, setDownloadStatus] = useState<TransformersProgress | null>(null);
  const [webllmStatus, setWebllmStatus] = useState<WebLLMProgress | null>(null);
  const [chromeAIStatus, setChromeAIStatus] = useState<'available' | 'downloadable' | 'unavailable' | 'checking'>('checking');
  const [hasOAuth, setHasOAuth] = useState(false);

  const persistGrokOAuth = useCallback(async (tokens: ProviderOAuthTokens) => {
    const existing = await getProviderConfig(providerId);
    const typedKey = maskedKey ? existing?.apiKey : (apiKey || undefined);
    await setProviderConfig({
      providerId,
      apiKey: typedKey || existing?.apiKey,
      authType: 'oauth',
      oauth: tokens,
      model: selectedModel,
      baseUrl: baseUrl || existing?.baseUrl,
      isDefault: existing?.isDefault || !hasExisting,
    });
    setHasOAuth(true);
    setHasExisting(true);
    onConfigured?.();
  }, [apiKey, baseUrl, hasExisting, maskedKey, onConfigured, providerId, selectedModel]);

  const {
    status: oauthStatus,
    device: oauthDevice,
    error: oauthError,
    start: startOauthFlow,
    reset: resetOauthFlow,
    invalidate: invalidateOauthFlow,
    markConnected: markOauthConnected,
  } = useXaiDeviceOAuth({ persistTokens: persistGrokOAuth });

  const resetTestStatus = useCallback(() => {
    setTestStatus('idle');
    setTestError(null);
  }, []);

  const clearMaskedApiKey = useCallback(() => {
    setApiKey('');
    setMaskedKey(false);
  }, []);

  const downloadTransformersModel = useCallback(async () => {
    try {
      const { initTransformers } = await import('@/lib/ai/transformers-client');
      await initTransformers(selectedModel, setDownloadStatus);
    } catch {
      // Error status is surfaced through the progress callback.
    }
  }, [selectedModel]);

  const retryTransformersDownload = useCallback(() => {
    setDownloadStatus(null);
  }, []);

  const downloadWebllmModel = useCallback(async () => {
    try {
      const { initWebLLM } = await import('@/lib/ai/webllm-client');
      await initWebLLM(selectedModel, setWebllmStatus);
    } catch {
      // Error status is surfaced through the progress callback.
    }
  }, [selectedModel]);

  const retryWebllmDownload = useCallback(() => {
    setWebllmStatus(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      invalidateOauthFlow();
      return;
    }

    resetTestStatus();
    setShowKey(false);
    resetOauthFlow();
    let cancelled = false;

    void (async () => {
      const config = await getProviderConfig(providerId);
      if (cancelled) return;

      const oauthConnected = !!config?.oauth?.refreshToken;
      setHasOAuth(oauthConnected);
      if (oauthConnected) markOauthConnected();

      if (config) {
        setHasExisting(true);
        setSelectedModel(resolveStoredModelId(providerId, config.model));
        setBaseUrl(config.baseUrl || '');
        if (config.apiKey) {
          setMaskedKey(true);
          setApiKey('••••••••••••••••••••••••••••••••');
        } else {
          setMaskedKey(false);
          setApiKey('');
        }
      } else {
        setHasExisting(false);
        setMaskedKey(false);
        setApiKey('');
        setSelectedModel(provider.defaultModel);
        setBaseUrl('');
      }

      if (providerId === 'ollama') {
        const url = config?.baseUrl || 'http://localhost:11434';
        try {
          const models = await loadOllamaModelOptions(url);
          if (!cancelled) {
            setOllamaModels(models);
          }
        } catch {
          if (!cancelled) {
            setOllamaModels([]);
          }
        }
      }

      if (providerId === 'chrome-ai') {
        setChromeAIStatus('checking');
        const status = await loadChromeAIAvailability();
        if (!cancelled) {
          setChromeAIStatus(status);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    invalidateOauthFlow,
    isOpen,
    markOauthConnected,
    provider.defaultModel,
    providerId,
    resetOauthFlow,
    resetTestStatus,
  ]);

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value && !value.includes('•')) {
      setApiKey(value);
      setMaskedKey(false);
      resetTestStatus();
      return;
    }

    if (value === '') {
      setApiKey('');
      setMaskedKey(false);
      resetTestStatus();
    }
  }, [resetTestStatus]);

  const handleTest = useCallback(async () => {
    setTestStatus('testing');
    setTestError(null);

    try {
      if (providerId === 'transformers' || providerId === 'webllm') {
        const hasWebGPU = 'gpu' in navigator;
        if (providerId === 'webllm' && !hasWebGPU) {
          setTestStatus('error');
          setTestError('WebGPU is required for WebLLM but not available in this browser.');
          return;
        }

        setTestStatus('success');
        return;
      }

      if (providerId === 'chrome-ai') {
        const status = await loadChromeAIAvailability();
        if (status === 'unavailable') {
          setTestStatus('error');
          setTestError('Chrome Built-in AI is not available. Enable both flags: chrome://flags/#optimization-guide-on-device-model AND chrome://flags/#prompt-api-for-gemini-nano-multimodal-input');
          return;
        }

        setChromeAIStatus(status);
        setTestStatus('success');
        return;
      }

      if (providerId === 'cursor') {
        const url = baseUrl || 'http://localhost:4646/v1';
        const testKey = apiKey && !maskedKey
          ? apiKey
          : await getStoredProviderKey(providerId, apiKey, maskedKey).catch(() => null);
        const { testCursorConnection } = await import('@/lib/ai/cursor-client');
        try {
          await testCursorConnection(url, testKey || undefined);
          setTestStatus('success');
        } catch (error) {
          setTestStatus('error');
          setTestError(error instanceof Error ? error.message : 'Could not reach the Cursor proxy.');
        }
        return;
      }

      if (providerId === 'ollama') {
        const url = baseUrl || 'http://localhost:11434';
        const models = await loadOllamaModelOptions(url);
        if (models.length === 0) {
          setTestStatus('error');
          setTestError('Ollama is running but no models found. Run: ollama pull llama3.2:3b');
          return;
        }

        setOllamaModels(models);
        setTestStatus('success');
        return;
      }

      const testKey = await getStoredProviderKey(providerId, apiKey, maskedKey);
      if (!testKey) {
        setTestStatus('error');
        setTestError('Add an API key before testing this provider.');
        return;
      }

      await streamServerProviderResponse({
        prompt: 'Reply with exactly: API key validated',
        apiKey: testKey,
        provider: providerId,
        model: selectedModel,
        baseUrl: baseUrl || undefined,
        maxOutputTokens: 64,
        systemPromptOverride: 'You are a connection test. Reply with exactly: API key validated',
      });

      setTestStatus('success');
    } catch (error) {
      setTestStatus('error');
      setTestError(error instanceof Error ? error.message : 'Connection failed');
    }
  }, [apiKey, baseUrl, maskedKey, providerId, selectedModel]);

  const handleXaiOAuthStart = useCallback(async () => {
    if (providerId !== 'grok') return;
    await startOauthFlow();
  }, [providerId, startOauthFlow]);

  const handleXaiOAuthCancel = useCallback(() => {
    resetOauthFlow(hasOAuth ? 'connected' : 'idle');
  }, [hasOAuth, resetOauthFlow]);

  const handleXaiOAuthDisconnect = useCallback(async () => {
    invalidateOauthFlow();
    const existing = await getProviderConfig(providerId);
    if (!existing) {
      setHasOAuth(false);
      resetOauthFlow();
      return;
    }

    if (existing.apiKey || maskedKey || apiKey) {
      await setProviderConfig({
        providerId,
        apiKey: maskedKey ? existing.apiKey : (apiKey || existing.apiKey),
        authType: 'api-key',
        model: selectedModel,
        baseUrl: baseUrl || existing.baseUrl,
        isDefault: existing.isDefault,
      });
      setHasOAuth(false);
      resetOauthFlow();
      onConfigured?.();
      return;
    }

    await deleteProviderConfig(providerId);
    setHasExisting(false);
    setHasOAuth(false);
    resetOauthFlow();
    onConfigured?.();
  }, [
    apiKey,
    baseUrl,
    invalidateOauthFlow,
    maskedKey,
    onConfigured,
    providerId,
    resetOauthFlow,
    selectedModel,
  ]);

  const handleSave = useCallback(async () => {
    const existing = await getProviderConfig(providerId);
    const typedKey = maskedKey ? (existing?.apiKey || '') : apiKey;
    const oauth = existing?.oauth;
    const oauthConnected = !!oauth?.refreshToken;
    if (!typedKey && !oauthConnected && !provider.isLocal && !provider.keyOptional) return;

    await setProviderConfig({
      providerId,
      apiKey: typedKey || undefined,
      authType: oauthConnected ? 'oauth' : typedKey ? 'api-key' : existing?.authType,
      oauth: oauthConnected ? oauth : undefined,
      model: selectedModel,
      baseUrl: baseUrl || undefined,
      isDefault: existing?.isDefault || !hasExisting,
    });

    onConfigured?.();
    onClose();
  }, [
    apiKey,
    baseUrl,
    hasExisting,
    maskedKey,
    onClose,
    onConfigured,
    provider.isLocal,
    provider.keyOptional,
    providerId,
    selectedModel,
  ]);

  const handleDelete = useCallback(async () => {
    resetOauthFlow();
    await deleteProviderConfig(providerId);
    setHasExisting(false);
    setHasOAuth(false);
    setSelectedModel(provider.defaultModel);
    setBaseUrl('');
    clearMaskedApiKey();
    resetTestStatus();
    onConfigured?.();
  }, [
    clearMaskedApiKey,
    onConfigured,
    provider.defaultModel,
    providerId,
    resetOauthFlow,
    resetTestStatus,
  ]);

  const canSave = provider.isLocal || provider.keyOptional || maskedKey || apiKey.length > 0 || hasOAuth;
  const canTest = provider.isLocal || provider.keyOptional || maskedKey || apiKey.length > 0 || hasOAuth;

  return {
    provider,
    apiKey,
    maskedKey,
    showKey,
    selectedModel,
    baseUrl,
    testStatus,
    testError,
    hasExisting,
    ollamaModels,
    downloadStatus,
    webllmStatus,
    chromeAIStatus,
    hasOAuth,
    oauthStatus,
    oauthDevice,
    oauthError,
    canSave,
    canTest,
    setShowKey,
    setSelectedModel,
    setBaseUrl,
    handleInputChange,
    clearMaskedApiKey,
    handleTest,
    handleSave,
    handleDelete,
    handleXaiOAuthStart,
    handleXaiOAuthCancel,
    handleXaiOAuthDisconnect,
    downloadTransformersModel,
    retryTransformersDownload,
    downloadWebllmModel,
    retryWebllmDownload,
  };
}
