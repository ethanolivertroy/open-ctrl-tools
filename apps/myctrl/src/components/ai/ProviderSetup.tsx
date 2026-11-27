/**
 * ProviderSetup Component
 *
 * Per-provider configuration dialog. Handles API key input,
 * model selection, connection testing, and base URL for
 * OpenRouter/Ollama.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import {
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
} from 'lucide-react';
import { type ProviderId } from '@/lib/ai/providers';
import { XAI_OAUTH_LOGIN_LABEL } from '@/lib/ai/xai-oauth';
import { useProviderSetupState } from './useProviderSetupState';

interface ProviderSetupProps {
  providerId: ProviderId;
  isOpen: boolean;
  onClose: () => void;
  onConfigured?: () => void;
}

export function ProviderSetup({
  providerId,
  isOpen,
  onClose,
  onConfigured,
}: ProviderSetupProps) {
  const {
    provider,
    apiKey,
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
  } = useProviderSetupState({
    providerId,
    isOpen,
    onClose,
    onConfigured,
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {provider.name} Setup
          </SheetTitle>
          <SheetDescription>{provider.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {providerId === 'grok' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div>
                <h4 className="text-sm font-medium">X Premium / SuperGrok</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sign in with your subscription, same flow as pi. No console API key required.
                </p>
              </div>

              {hasOAuth && oauthStatus !== 'waiting' && oauthStatus !== 'starting' ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-sm text-green-500">
                    <CheckCircle className="h-4 w-4" />
                    Subscription connected
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleXaiOAuthDisconnect()}
                    className="text-xs text-muted-foreground hover:text-red-400"
                  >
                    Disconnect
                  </button>
                </div>
              ) : oauthStatus === 'waiting' && oauthDevice ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Approve access at xAI, then return here. Code:
                  </p>
                  <p className="rounded-md bg-background px-3 py-2 font-mono text-lg tracking-widest">
                    {oauthDevice.userCode}
                  </p>
                  <a
                    href={oauthDevice.verificationUriComplete || oauthDevice.verificationUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open verification page
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={handleXaiOAuthCancel}
                    className="block text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleXaiOAuthStart()}
                  disabled={oauthStatus === 'starting'}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {oauthStatus === 'starting' ? 'Starting sign-in...' : XAI_OAUTH_LOGIN_LABEL}
                </button>
              )}

              {oauthStatus === 'error' && oauthError ? (
                <p className="text-xs text-red-400">{oauthError}</p>
              ) : null}
            </div>
          )}

          {!provider.isLocal && (
            <div className="space-y-2">
              <label htmlFor="provider-key" className="text-sm font-medium">
                API Key{providerId === 'grok' ? (
                  <span className="font-normal text-muted-foreground"> (optional if subscribed)</span>
                ) : null}
              </label>
              <div className="relative">
                <input
                  id="provider-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={handleInputChange}
                  onFocus={(event) => {
                    if (event.target.value.includes('•')) {
                      clearMaskedApiKey();
                    }
                  }}
                  placeholder={provider.keyPlaceholder || 'Enter API key...'}
                  className="w-full p-3 pr-10 rounded-lg border border-border bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your key from{' '}
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {new URL(provider.docsUrl).hostname}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          )}

          {provider.supportsBaseUrl && (
            <div className="space-y-2">
              <label htmlFor="base-url" className="text-sm font-medium">
                Base URL <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="base-url"
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder={provider.baseUrlPlaceholder || 'https://api.example.com/v1'}
                className="w-full p-3 rounded-lg border border-border bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}

          {providerId === 'cursor' && (
            <details className="text-xs text-muted-foreground group">
              <summary className="cursor-pointer select-none hover:text-foreground transition-colors font-medium">
                Setup guide — how to connect your Cursor account
              </summary>
              <div className="mt-2 space-y-2 pl-1 border-l-2 border-border ml-1">
                <div>
                  <span className="font-medium text-foreground">1. Create an API key</span>
                  <br />
                  Generate a <code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">crsr_...</code> key at{' '}
                  <a
                    href="https://cursor.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    cursor.com/dashboard
                  </a>{' '}
                  → API Keys.
                </div>
                <div>
                  <span className="font-medium text-foreground">2. Run the bridge</span>
                  <br />
                  <code className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono break-all">
                    CURSOR_API_KEY=crsr_... npm run cursor-bridge
                  </code>
                </div>
                <div>
                  <span className="font-medium text-foreground">3. Save</span>
                  <br />
                  Keep the default base URL (<code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">http://localhost:4646/v1</code>),
                  pick a model, and hit Test Connection.
                </div>
              </div>
            </details>
          )}

          {providerId === 'ollama' && (
            <div className="space-y-2">
              <label htmlFor="ollama-url" className="text-sm font-medium">
                Ollama URL
              </label>
              <input
                id="ollama-url"
                type="url"
                value={baseUrl || 'http://localhost:11434'}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="http://localhost:11434"
                className="w-full p-3 rounded-lg border border-border bg-background text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <details className="text-xs text-muted-foreground group">
                <summary className="cursor-pointer select-none hover:text-foreground transition-colors font-medium">
                  Setup guide — click if Ollama isn't connecting
                </summary>
                <div className="mt-2 space-y-2 pl-1 border-l-2 border-border ml-1">
                  <div>
                    <span className="font-medium text-foreground">1. Install Ollama</span>
                    <br />
                    Download from{' '}
                    <a
                      href="https://ollama.ai/download"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      ollama.ai/download
                    </a>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">2. Pull a model</span>
                    <br />
                    <code className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono">
                      ollama pull llama3.2:3b
                    </code>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">3. Allow browser access</span>
                    <br />
                    <span>
                      This site runs at{' '}
                      <code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">
                        {typeof window !== 'undefined' ? window.location.origin : 'https://myctrl.tools'}
                      </code>{' '}
                      — Ollama must allow this origin.
                    </span>
                    <div className="mt-1.5 space-y-1">
                      <div>
                        <span className="text-muted-foreground/70">macOS:</span>{' '}
                        <code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono break-all">
                          launchctl setenv OLLAMA_ORIGINS "*"
                        </code>
                        <span className="text-muted-foreground/50"> then restart Ollama</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground/70">Linux:</span>{' '}
                        <code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono break-all">
                          OLLAMA_ORIGINS="*" ollama serve
                        </code>
                      </div>
                      <div>
                        <span className="text-muted-foreground/70">Windows:</span>{' '}
                        <span>
                          Set{' '}
                          <code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">
                            OLLAMA_ORIGINS
                          </code>{' '}
                          to{' '}
                          <code className="px-1 py-0.5 rounded bg-muted text-[11px] font-mono">
                            *
                          </code>{' '}
                          in System Environment Variables, restart Ollama
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">4. Test Connection</span>
                    <br />
                    Click the button below — your models should appear in the dropdown.
                  </div>
                </div>
              </details>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="model-select" className="text-sm font-medium">
              Model
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              className="w-full p-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {providerId === 'ollama' && ollamaModels.length > 0
                ? ollamaModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))
                : provider.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                      {model.supportsStructuredOutput ? '' : ' (text only)'}
                    </option>
                  ))}
            </select>
            {(() => {
              const model = provider.models.find((item) => item.id === selectedModel);
              if (!model) return null;

              return (
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">Model Capabilities</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Structured views</span>
                    <span className={model.supportsStructuredOutput ? 'text-green-500' : 'text-amber-500'}>
                      {model.supportsStructuredOutput ? 'Yes — JSON views' : 'No — text only'}
                    </span>
                    <span className="text-muted-foreground">Context window</span>
                    <span className="text-foreground">{model.contextWindow.toLocaleString()} tokens</span>
                    <span className="text-muted-foreground">Max output</span>
                    <span className="text-foreground">{model.maxOutputTokens.toLocaleString()} tokens</span>
                    <span className="text-muted-foreground">Data source</span>
                    <span className="text-foreground">
                      {model.supportsStructuredOutput ? 'Your framework data' : 'LLM knowledge'}
                    </span>
                  </div>
                  {!model.supportsStructuredOutput && (
                    <p className="text-xs text-amber-500 pt-1 border-t border-border/30">
                      Text responses only. For interactive control views, use a 2B+ model or cloud provider.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {providerId === 'transformers' && (
            <div className="space-y-3">
              {!downloadStatus && (
                <button
                  onClick={downloadTransformersModel}
                  className="w-full px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-sm font-medium"
                >
                  Download Model
                </button>
              )}

              {downloadStatus && downloadStatus.status === 'downloading' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{downloadStatus.message}</span>
                    <span className="text-primary font-mono">
                      {Math.round((downloadStatus.progress || 0) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${(downloadStatus.progress || 0) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {downloadStatus && downloadStatus.status === 'loading' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">{downloadStatus.message}</span>
                </div>
              )}

              {downloadStatus && downloadStatus.status === 'ready' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500">Model ready — cached in browser</span>
                </div>
              )}

              {downloadStatus && downloadStatus.status === 'error' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">{downloadStatus.message}</span>
                  </div>
                  <button
                    onClick={retryTransformersDownload}
                    className="text-xs text-primary hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {downloadStatus && downloadStatus.status === 'generating' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">{downloadStatus.message}</span>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Models are downloaded to your browser's cache (200-600MB). Subsequent visits use the
                cached model instantly.
              </p>
            </div>
          )}

          {providerId === 'webllm' && (
            <div className="space-y-3">
              {!webllmStatus && (
                <button
                  onClick={downloadWebllmModel}
                  className="w-full px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-sm font-medium"
                >
                  Download Model
                </button>
              )}

              {webllmStatus && webllmStatus.status === 'downloading' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">{webllmStatus.message}</span>
                    <span className="text-primary font-mono shrink-0">
                      {Math.round((webllmStatus.progress || 0) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${(webllmStatus.progress || 0) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {webllmStatus && webllmStatus.status === 'loading' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">{webllmStatus.message}</span>
                </div>
              )}

              {webllmStatus && webllmStatus.status === 'ready' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500">Model ready — cached in browser</span>
                </div>
              )}

              {webllmStatus && webllmStatus.status === 'error' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">{webllmStatus.message}</span>
                  </div>
                  <button
                    onClick={retryWebllmDownload}
                    className="text-xs text-primary hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                WebLLM models are 1-4GB. They run entirely in your browser via WebGPU and are cached
                after first download.
              </p>
            </div>
          )}

          {providerId === 'chrome-ai' && (
            <div className="space-y-3">
              {chromeAIStatus === 'checking' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Checking availability...</span>
                </div>
              )}

              {chromeAIStatus === 'available' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500">Gemini Nano is available — zero download needed</span>
                </div>
              )}

              {chromeAIStatus === 'downloadable' && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm text-amber-400">
                    Gemini Nano needs to download (~1.5GB one-time). Chrome will handle the download
                    automatically on first use.
                  </p>
                </div>
              )}

              {chromeAIStatus === 'unavailable' && (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400">
                      Chrome Built-in AI is not available in this browser.
                    </p>
                    <p className="text-xs text-red-400/70 mt-1">
                      Requires Chrome 127+ with two flags enabled:
                    </p>
                    <ul className="text-xs text-red-400/70 mt-1 ml-4 list-disc space-y-0.5">
                      <li>chrome://flags/#optimization-guide-on-device-model</li>
                      <li>chrome://flags/#prompt-api-for-gemini-nano-multimodal-input</li>
                    </ul>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Uses Gemini Nano built into Chrome. No data leaves your device. Works best for text
                Q&A.
              </p>
            </div>
          )}

          {testStatus !== 'idle' && (
            <div
              className={`p-3 rounded-lg border ${
                testStatus === 'success'
                  ? 'bg-green-500/10 border-green-500/30'
                  : testStatus === 'error'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-muted/30 border-border'
              }`}
            >
              <div className="flex items-center gap-2">
                {testStatus === 'testing' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Testing connection...</span>
                  </>
                )}
                {testStatus === 'success' && (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-500">Connection successful!</span>
                  </>
                )}
                {testStatus === 'error' && (
                  <>
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">{testError || 'Connection failed'}</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={!canTest || testStatus === 'testing'}
              className="flex-1 px-4 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              Save
            </button>
          </div>

          {hasExisting && (
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Remove Provider
            </button>
          )}

          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">Security</h4>
                  <p className="text-xs text-muted-foreground">
                    Keys and X Premium tokens stay in IndexedDB on this device. They are sent over HTTPS
                    only to the provider or our OAuth proxy. Clear them on a shared computer.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ProviderSetup;
