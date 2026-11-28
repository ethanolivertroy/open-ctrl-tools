import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProviderVault } from '@/components/ai/ProviderVault';
import { GrcLankerMarkdown } from '@/components/ai/GrcLankerMarkdown';
import { useAIProviderState } from '@/components/ai/useAIProviderState';
import { useAITextGeneration } from '@/components/ai/useAITextGeneration';
import {
  buildGuidanceGrcLankerSystemPrompt,
  getGuidanceGrcLankerQuickActions,
  type GuidanceGrcLankerContext,
} from '@/lib/guidance-grclanker-prompt';
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers';

interface GuidanceGrcLankerProps extends GuidanceGrcLankerContext {}

function getInitialStatusMessage(providerId: ProviderId, providerName: string): string {
  if (providerId === 'ollama') {
    return 'Connecting to Ollama...';
  }

  return `Waiting for ${providerName} to respond...`;
}

export function GuidanceGrcLanker(props: GuidanceGrcLankerProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const {
    hasProvider: hasApiKey,
    activeProvider,
    isVaultOpen,
    setIsVaultOpen,
    refreshProviderState,
  } = useAIProviderState({ initialHasProvider: null });
  const responseRef = useRef<HTMLDivElement>(null);

  const quickActions = getGuidanceGrcLankerQuickActions(props);
  const providerInfo = PROVIDERS[activeProvider];
  const isLocalishProvider = !!(providerInfo?.isBrowserOnly || providerInfo?.isLocal);
  const promptMode = activeProvider === 'ollama'
    ? 'minimal'
    : isLocalishProvider
      ? 'compact'
      : 'full';
  const systemPrompt = buildGuidanceGrcLankerSystemPrompt(props, {
    mode: promptMode,
  });
  const {
    streamStatus,
    response,
    error,
    statusMessage,
    requestText,
    stopStreaming,
  } = useAITextGeneration({
    activeProvider,
    systemPrompt,
    context: { frameworkId: props.guideId, family: 'technology-guidance' },
    maxOutputTokens: activeProvider === 'grok' ? 4096 : 1200,
    reasoningEffort: activeProvider === 'grok' ? 'medium' : undefined,
    timeoutMs: activeProvider === 'grok' ? 120000 : 45000,
    getInitialStatusMessage,
    getTimeoutMessage: (providerName) => `${providerName} took too long to respond. Try a shorter question or switch to a faster provider.`,
  });

  useEffect(() => {
    if (responseRef.current && streamStatus === 'streaming') {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response, streamStatus]);

  async function generate(prompt: string) {
    if (!prompt.trim() || streamStatus === 'streaming') return;

    setCopyState('idle');
    await requestText(prompt);
  }

  function handleAsk() {
    if (!customPrompt.trim()) return;
    generate(customPrompt.trim());
  }

  async function copyResponse() {
    if (!response) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(response);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = response;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  if (hasApiKey === null) {
    return (
      <Card className="border-border bg-card/80">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">GRCLanker</span>
            <Badge variant="outline" className="text-[11px]">{props.guideName}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Loading provider settings...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasApiKey) {
    return (
      <Card className="border-border bg-card/80">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">GRCLanker</span>
            <Badge variant="outline" className="text-[11px]">{props.guideName}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Connect Grok or another provider to ask for secure defaults, implementation steps, review guidance, or evidence expectations for this guide.
          </p>
          <Button size="sm" onClick={() => setIsVaultOpen(true)}>
            Set Up AI Provider
          </Button>
          {isVaultOpen && (
            <ProviderVault
              isOpen={isVaultOpen}
              onClose={() => setIsVaultOpen(false)}
              onProvidersChanged={refreshProviderState}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="border-border bg-card/80">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">GRCLanker</span>
                <Badge variant="outline" className="text-[11px]">{props.guideName}</Badge>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Ask for secure defaults, implementation steps, evidence requests, likely findings, or framework-aligned guidance.
              </p>
            </div>
            <button
              onClick={() => setIsVaultOpen(true)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              title="Provider settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => generate(action.prompt)}
                disabled={streamStatus === 'streaming'}
                className="px-2.5 py-1 text-xs rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 text-foreground transition-colors disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {(response || streamStatus === 'streaming') && (
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Agent Response
              </div>
              {response && streamStatus !== 'streaming' && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs"
                  onClick={copyResponse}
                >
                  {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy response'}
                </Button>
              )}
            </div>
            <div ref={responseRef} className="max-h-[50vh] overflow-y-auto">
              <GrcLankerMarkdown content={response} />
            </div>
            {!response && statusMessage && (
              <p className="mb-0 text-sm text-muted-foreground">{statusMessage}</p>
            )}
            {streamStatus === 'streaming' && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-muted-foreground">{statusMessage || 'Generating...'}</span>
                <button
                  onClick={stopStreaming}
                  className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                >
                  Stop
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          {error}
        </div>
      )}

      <Card className="border-border bg-card/80">
        <CardContent className="p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ask a question</div>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={`Ask what to change in your org or repo, what a safe baseline looks like, or what evidence to collect for ${props.guideName}...`}
            className="min-h-[110px] w-full rounded-lg border bg-background px-3 py-2 text-sm"
            disabled={streamStatus === 'streaming'}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleAsk}
              disabled={!customPrompt.trim() || streamStatus === 'streaming'}
            >
              Ask
            </Button>
          </div>
        </CardContent>
      </Card>

      {isVaultOpen && (
        <ProviderVault
          isOpen={isVaultOpen}
          onClose={() => setIsVaultOpen(false)}
          onProvidersChanged={refreshProviderState}
        />
      )}
    </div>
  );
}

export default GuidanceGrcLanker;
