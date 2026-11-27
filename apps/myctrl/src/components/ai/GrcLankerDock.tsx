import * as React from 'react';
import { MessageSquarePlus, Send, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProviderVault } from './ProviderVault';
import { GrcLankerMarkdown } from './GrcLankerMarkdown';
import { useAIProviderState } from './useAIProviderState';
import { useAITextGeneration } from './useAITextGeneration';
import { buildGlobalGrcLankerSystemPrompt } from '@/lib/grclanker-prompts';
import { clipConversationHistory } from '@/lib/ai/conversation';
import { getGenerationDefaults } from '@/lib/ai/providers';
import {
  consumePendingAIChatRequest,
  consumePendingAISettingsRequest,
  OPEN_AI_CHAT_EVENT,
  OPEN_AI_SETTINGS_EVENT,
  type OpenAIChatDetail,
} from '@/lib/ai-chat-events';

interface GrcLankerDockProps {
  frameworkId?: string;
  controlSlug?: string;
  initialSettingsOpen?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'Summarize what this control requires and typical evidence.',
  'What gaps should a reviewer look for first?',
  'Draft next actions my team can assign.',
];

export function GrcLankerDock({
  frameworkId,
  controlSlug,
  initialSettingsOpen = false,
}: GrcLankerDockProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [pendingPrompt, setPendingPrompt] = React.useState<string | null>(null);
  const {
    hasProvider,
    activeProvider,
    isVaultOpen,
    setIsVaultOpen,
    refreshProviderState,
  } = useAIProviderState({ initialHasProvider: null });

  const systemPrompt = React.useMemo(
    () => buildGlobalGrcLankerSystemPrompt({
      frameworkId,
      controlId: controlSlug,
    }),
    [frameworkId, controlSlug],
  );

  const generationDefaults = getGenerationDefaults(activeProvider);
  const {
    streamStatus,
    response,
    error,
    requestText,
    stopStreaming,
    clearOutput,
  } = useAITextGeneration({
    activeProvider,
    systemPrompt,
    context: frameworkId ? { frameworkId, controlId: controlSlug } : undefined,
    maxOutputTokens: generationDefaults.maxOutputTokens,
    reasoningEffort: activeProvider === 'grok' ? 'medium' : undefined,
    timeoutMs: generationDefaults.timeoutMs,
  });

  React.useEffect(() => {
    if (initialSettingsOpen || consumePendingAISettingsRequest()) {
      setIsVaultOpen(true);
    }

    const pending = consumePendingAIChatRequest();
    if (!pending) return;
    setOpen(true);
    if (pending !== true && pending.prompt) {
      setPendingPrompt(pending.prompt);
    }
    if (pending !== true && pending.newThread) {
      setMessages([]);
      clearOutput();
    }
  }, [clearOutput, initialSettingsOpen, setIsVaultOpen]);

  React.useEffect(() => {
    const onChat = (event: Event) => {
      const detail = (event as CustomEvent<OpenAIChatDetail>).detail;
      setOpen(true);
      if (detail?.newThread) {
        setMessages([]);
        clearOutput();
      }
      if (detail?.prompt) setPendingPrompt(detail.prompt);
    };
    const onSettings = () => setIsVaultOpen(true);
    document.addEventListener(OPEN_AI_CHAT_EVENT, onChat);
    document.addEventListener(OPEN_AI_SETTINGS_EVENT, onSettings);
    return () => {
      document.removeEventListener(OPEN_AI_CHAT_EVENT, onChat);
      document.removeEventListener(OPEN_AI_SETTINGS_EVENT, onSettings);
    };
  }, [clearOutput, setIsVaultOpen]);

  const send = React.useCallback(async (prompt: string) => {
    if (!prompt.trim() || streamStatus === 'streaming') return;
    if (!hasProvider) {
      setIsVaultOpen(true);
      return;
    }

    const conversation = clipConversationHistory(messages);
    const full = await requestText(prompt, { conversation });
    if (!full) return;
    setMessages((current) => [
      ...current,
      { role: 'user', content: prompt },
      { role: 'assistant', content: full },
    ]);
    setDraft('');
  }, [hasProvider, messages, requestText, setIsVaultOpen, streamStatus]);

  React.useEffect(() => {
    if (!pendingPrompt) return;
    const next = pendingPrompt;
    setPendingPrompt(null);
    void send(next);
  }, [pendingPrompt, send]);

  if (!open) return null;

  return (
    <>
      <div className="fixed bottom-20 right-4 z-50 flex max-h-[min(720px,calc(100vh-6rem))] w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <div className="text-sm font-medium">GRCLanker</div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              title="New thread"
              onClick={() => {
                setMessages([]);
                clearOutput();
              }}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              title="Provider settings"
              onClick={() => setIsVaultOpen(true)}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              title="Close"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {!hasProvider ? (
            <p className="text-xs text-muted-foreground">
              Connect Grok or another provider to start chatting.
            </p>
          ) : null}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`text-sm ${message.role === 'user' ? 'rounded-md bg-primary/5 px-2 py-1.5' : ''}`}
            >
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                {message.role === 'user' ? 'You' : 'GRCLanker'}
              </div>
              {message.role === 'assistant' ? (
                <GrcLankerMarkdown content={message.content} />
              ) : (
                <div className="text-[13px] leading-relaxed">{message.content}</div>
              )}
            </div>
          ))}

          {streamStatus === 'streaming' ? (
            <div>
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">GRCLanker</div>
              <GrcLankerMarkdown content={response || 'Thinking...'} />
              <button className="mt-2 text-xs text-muted-foreground hover:text-foreground" onClick={stopStreaming}>
                Stop
              </button>
            </div>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          {messages.length === 0 && streamStatus === 'idle' ? (
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-left text-xs hover:bg-primary/10"
                  onClick={() => void send(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask GRCLanker..."
            className="min-h-[44px] w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            rows={2}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
          />
          <Button type="submit" size="sm" className="h-9 w-9 p-0" disabled={streamStatus === 'streaming' || !draft.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>

      {isVaultOpen ? (
        <ProviderVault
          isOpen={isVaultOpen}
          onClose={() => setIsVaultOpen(false)}
          onProvidersChanged={refreshProviderState}
        />
      ) : null}
    </>
  );
}
