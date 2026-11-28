import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  consumePendingAIChatRequest,
  consumePendingAISettingsRequest,
  OPEN_AI_CHAT_EVENT,
  OPEN_AI_SETTINGS_EVENT,
  type OpenAIChatDetail,
} from '@/lib/ai-chat-events';
import { clipConversationHistory, type ConversationTurn } from '@/lib/ai/conversation';
import { FRAMEWORK_CONFIGS } from '@/data/framework-configs';
import type { AIContext } from '@/lib/ai-data-context';
import type { VoiceMode } from '@/lib/voice/protocol';
import { useAIProviderState } from './useAIProviderState';
import { useAITextGeneration } from './useAITextGeneration';
import { GrcLankerMarkdown } from './GrcLankerMarkdown';
import { ProviderVault } from './ProviderVault';
import { VoiceSessionView } from './VoiceSessionView';
import { MessageSquare, MessageSquarePlus, Mic, Send, Settings } from 'lucide-react';

interface GrcLankerDockProps {
  frameworkId?: string;
  controlSlug?: string;
  controlTitle?: string;
  assessmentQuestions?: string[];
  initialSettingsOpen?: boolean;
}

const QUICK_PROMPTS = [
  'Explain this control and key audit evidence needed',
  'Suggest Terraform/cloud verification commands',
  'Summarize cross-framework equivalents',
];

interface DockPromptScope {
  frameworkId?: string;
  frameworkName?: string;
  controlId?: string;
  controlTitle?: string;
}

function buildDockSystemPrompt(scope?: DockPromptScope): string {
  const label = scope?.frameworkId
    ? `Framework: ${scope.frameworkName || scope.frameworkId}${scope.controlId ? `, Control: ${scope.controlId}` : ''}${scope.controlTitle ? ` (${scope.controlTitle})` : ''}.`
    : 'General myctrl.tools security compliance workspace.';

  return [
    'You are GRCLanker, a concise, authoritative security compliance engineering assistant.',
    label,
    'Provide accurate implementation guidance, audit evidence expectations, and verification commands without fluff.',
  ].join('\n');
}

export function GrcLankerDock({
  frameworkId,
  controlSlug,
  controlTitle,
  assessmentQuestions,
  initialSettingsOpen = false,
}: GrcLankerDockProps) {
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'chat' | 'voice'>('chat');
  const [voiceMode, setVoiceMode] = React.useState<VoiceMode>('copilot');
  const [ctxOverride, setCtxOverride] = React.useState<OpenAIChatDetail | null>(null);
  const [messages, setMessages] = React.useState<ConversationTurn[]>([]);
  const [draft, setDraft] = React.useState('');
  const [pendingPrompt, setPendingPrompt] = React.useState<string | null>(null);

  const effectiveFrameworkId = ctxOverride?.frameworkId ?? frameworkId;
  const effectiveControlSlug = ctxOverride?.controlSlug ?? controlSlug;
  const effectiveControlTitle = ctxOverride?.controlTitle ?? controlTitle;
  const effectiveQuestions = ctxOverride?.assessmentQuestions ?? assessmentQuestions;

  const aiContext = React.useMemo<AIContext | undefined>(() => {
    if (!effectiveFrameworkId) return undefined;
    return {
      frameworkId: effectiveFrameworkId,
      controlId: effectiveControlSlug,
    };
  }, [effectiveControlSlug, effectiveFrameworkId]);

  const systemPrompt = React.useMemo(
    () =>
      buildDockSystemPrompt(
        effectiveFrameworkId
          ? {
              frameworkId: effectiveFrameworkId,
              frameworkName: FRAMEWORK_CONFIGS[effectiveFrameworkId]?.name || effectiveFrameworkId,
              controlId: effectiveControlSlug,
              controlTitle: effectiveControlTitle,
            }
          : undefined,
      ),
    [effectiveControlSlug, effectiveControlTitle, effectiveFrameworkId],
  );

  const {
    hasProvider,
    activeProvider,
    isVaultOpen,
    setIsVaultOpen,
    refreshProviderState,
  } = useAIProviderState({ initialHasProvider: null });

  const {
    streamStatus,
    response,
    error,
    stopStreaming,
    clearOutput,
    requestText,
  } = useAITextGeneration({
    activeProvider,
    systemPrompt,
    context: aiContext,
  });

  const applyChatDetail = React.useCallback(
    (detail: OpenAIChatDetail | undefined) => {
      setOpen(true);
      if (detail) {
        setCtxOverride(detail);
        if (detail.tab) {
          setActiveTab(detail.tab);
        } else if (detail.voiceMode) {
          setActiveTab('voice');
        }
        if (detail.voiceMode) {
          setVoiceMode(detail.voiceMode);
        }
        if (detail.newThread) {
          setMessages([]);
          clearOutput();
        }
        if (detail.prompt) {
          setActiveTab('chat');
          setPendingPrompt(detail.prompt);
        }
      }
    },
    [clearOutput],
  );

  React.useEffect(() => {
    const pendingChat = consumePendingAIChatRequest();
    if (pendingChat !== null) {
      applyChatDetail(pendingChat === true ? undefined : pendingChat);
    }
    if (consumePendingAISettingsRequest() || initialSettingsOpen) {
      setIsVaultOpen(true);
    }
  }, [applyChatDetail, initialSettingsOpen, setIsVaultOpen]);

  React.useEffect(() => {
    const onChat = (event: Event) => {
      const detail = (event as CustomEvent<OpenAIChatDetail | undefined>).detail;
      consumePendingAIChatRequest();
      applyChatDetail(detail);
    };
    const onSettings = () => {
      consumePendingAISettingsRequest();
      setIsVaultOpen(true);
    };
    document.addEventListener(OPEN_AI_CHAT_EVENT, onChat);
    document.addEventListener(OPEN_AI_SETTINGS_EVENT, onSettings);
    return () => {
      document.removeEventListener(OPEN_AI_CHAT_EVENT, onChat);
      document.removeEventListener(OPEN_AI_SETTINGS_EVENT, onSettings);
    };
  }, [applyChatDetail, setIsVaultOpen]);

  const send = React.useCallback(
    async (prompt: string) => {
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
    },
    [hasProvider, messages, requestText, setIsVaultOpen, streamStatus],
  );

  React.useEffect(() => {
    if (!pendingPrompt) return;
    const next = pendingPrompt;
    setPendingPrompt(null);
    void send(next);
  }, [pendingPrompt, send]);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={true}
          className="w-full sm:max-w-lg p-0 flex flex-col bg-card"
        >
          <SheetHeader className="px-4 py-3 border-b border-border shrink-0 pr-12">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <SheetTitle className="text-sm font-semibold">GRCLanker</SheetTitle>
                <SheetDescription className="text-xs truncate">
                  {effectiveControlTitle
                    ? `${effectiveControlSlug || ''} · ${effectiveControlTitle}`
                    : effectiveFrameworkId || 'Compliance Chat & Live Voice'}
                </SheetDescription>
              </div>
              <div className="flex items-center gap-1">
                {activeTab === 'chat' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    title="New chat thread"
                    onClick={() => {
                      setMessages([]);
                      clearOutput();
                    }}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  title="Provider settings"
                  onClick={() => setIsVaultOpen(true)}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v === 'voice' ? 'voice' : 'chat')}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="px-4 py-2 border-b border-border/60 shrink-0 bg-muted/20">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="chat" className="text-xs gap-1.5 h-6">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Chat</span>
                </TabsTrigger>
                <TabsTrigger value="voice" className="text-xs gap-1.5 h-6">
                  <Mic className="h-3.5 w-3.5" />
                  <span>Voice (Speech-to-Speech)</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="mt-0 flex-1 flex flex-col min-h-0">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {!hasProvider && (
                  <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span>Connect an AI provider to start chatting.</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => setIsVaultOpen(true)}>
                      Configure
                    </Button>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`text-sm ${message.role === 'user' ? 'rounded-md bg-primary/10 px-3 py-2' : ''}`}
                  >
                    <div className="mb-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      {message.role === 'user' ? 'You' : 'GRCLanker'}
                    </div>
                    {message.role === 'assistant' ? (
                      <GrcLankerMarkdown content={message.content} />
                    ) : (
                      <div className="text-[13px] leading-relaxed">{message.content}</div>
                    )}
                  </div>
                ))}

                {streamStatus === 'streaming' && (
                  <div>
                    <div className="mb-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      GRCLanker
                    </div>
                    <GrcLankerMarkdown content={response || 'Thinking...'} />
                    <button
                      type="button"
                      className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={stopStreaming}
                    >
                      Stop generating
                    </button>
                  </div>
                )}

                {error && <p className="text-xs text-destructive">{error}</p>}

                {messages.length === 0 && streamStatus === 'idle' && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-left text-xs hover:bg-primary/10 transition-colors"
                        onClick={() => void send(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form
                className="flex items-end gap-2 border-t border-border p-3 shrink-0"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(draft);
                }}
              >
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask GRCLanker..."
                  aria-label="Ask GRCLanker"
                  className="min-h-[44px] w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  rows={2}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send(draft);
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-10 w-10 p-0 shrink-0"
                  aria-label="Send message"
                  disabled={streamStatus === 'streaming' || !draft.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="voice" className="mt-0 flex-1 flex flex-col min-h-0">
              <VoiceSessionView
                frameworkId={effectiveFrameworkId}
                controlSlug={effectiveControlSlug}
                controlTitle={effectiveControlTitle}
                assessmentQuestions={effectiveQuestions}
                requestedMode={voiceMode}
                onOpenSettings={() => setIsVaultOpen(true)}
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {isVaultOpen && (
        <ProviderVault
          isOpen={isVaultOpen}
          onClose={() => setIsVaultOpen(false)}
          onProvidersChanged={refreshProviderState}
        />
      )}
    </>
  );
}
