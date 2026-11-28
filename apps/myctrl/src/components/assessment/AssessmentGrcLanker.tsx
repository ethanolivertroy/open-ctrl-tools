/**
 * AssessmentGrcLanker — Sticky "GRCLanker" AI sidebar for gap analysis guidance.
 *
 * Provides context-aware AI assistance for each control:
 * - "Is this implemented?" — helps determine if a control is met
 * - "How to implement" — step-by-step implementation guidance
 * - "Evidence & testing" — what a 3PAO assessor looks for
 * - "What's missing?" — remediation for partial implementations
 *
 * Uses the existing /api/generate endpoint with a custom system prompt
 * (via systemPromptOverride) that's tailored to compliance guidance.
 *
 * Conversations are auto-saved to IndexedDB and browsable per-control.
 */

import { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProviderVault } from '@/components/ai/ProviderVault';
import { GrcLankerMarkdown } from '@/components/ai/GrcLankerMarkdown';
import {
  useAssessmentGrcLanker,
  type AssessmentGrcLankerProps,
} from './useAssessmentGrcLanker';

// === Component ===

export function AssessmentGrcLanker(props: AssessmentGrcLankerProps) {
  const { controlId, onOpenAIView } = props;
  const responseRef = useRef<HTMLDivElement>(null);
  const {
    streamStatus,
    response,
    error,
    customPrompt,
    setCustomPrompt,
    hasApiKey,
    isVaultOpen,
    setIsVaultOpen,
    refreshProviderState,
    messages,
    conversationId,
    history,
    showHistory,
    setShowHistory,
    quickActions,
    generate,
    openWorkbench,
    startNewThread,
    loadConversation,
    stopStreaming,
  } = useAssessmentGrcLanker(props);

  // Auto-scroll response as it streams
  useEffect(() => {
    if (responseRef.current && streamStatus === 'streaming') {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response, streamStatus]);

  // No API key — show setup
  if (!hasApiKey) {
    return (
      <div className="sticky top-4">
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <div className="text-2xl">🤖</div>
            <div className="text-sm font-medium">GRCLanker</div>
            <p className="text-xs text-muted-foreground">
              Connect Grok or another provider to get context-aware guidance for each control.
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
      </div>
    );
  }

  return (
    <div className="sticky top-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">GRCLanker</span>
          <Badge variant="outline" className="text-[11px]">{controlId}</Badge>
        </div>
        <div className="flex items-center gap-1">
          {/* History toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1 transition-colors rounded-md ${
              showHistory ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={`${history.length} saved conversation${history.length !== 1 ? 's' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
          </button>
          {/* New thread */}
          {messages.length > 0 && (
            <button
              onClick={startNewThread}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              title="New thread"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            </button>
          )}
          {/* Settings */}
          <button
            onClick={() => setIsVaultOpen(true)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
            title="Provider settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <Card className="border-border">
          <CardContent className="pt-3 pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Saved conversations ({history.length})
            </p>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 py-2">No conversations yet.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {history.map(conv => {
                  const firstUser = conv.messages.find(m => m.role === 'user');
                  const preview = firstUser?.content.slice(0, 60) || 'Conversation';
                  const isActive = conv.id === conversationId;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="truncate">{preview}{preview.length >= 60 ? '...' : ''}</div>
                      <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                        {new Date(conv.updatedAt).toLocaleDateString()} · {conv.messages.length} messages
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prior messages in thread */}
      {messages.length > 0 && streamStatus !== 'streaming' && (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {messages.slice(0, -1).map((msg, i) => (
            <div key={i} className={`text-xs px-2 py-1 rounded ${
              msg.role === 'user'
                ? 'bg-primary/5 text-muted-foreground'
                : 'text-muted-foreground/60'
            }`}>
              <span className="font-medium">{msg.role === 'user' ? 'You' : 'GRCLanker'}:</span>{' '}
              {msg.content.slice(0, 80)}{msg.content.length > 80 ? '...' : ''}
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5">
        {quickActions.map(action => (
          <button
            key={action.label}
            onClick={() => generate(action.prompt)}
            disabled={streamStatus === 'streaming'}
            className="px-2.5 py-1 text-xs rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 text-foreground transition-colors disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
          <Button
            size="sm"
            variant="outline"
            onClick={openWorkbench}
            className="h-7 px-2.5 text-xs"
          >
            Ask in GRCLanker
          </Button>
      </div>

      {/* Response area */}
      {(response || streamStatus === 'streaming') && (
        <Card className="border-primary/20">
          <CardContent className="pt-4">
            <div ref={responseRef} className="max-h-[60vh] overflow-y-auto">
              <GrcLankerMarkdown content={response} />
            </div>
            {streamStatus === 'streaming' && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-muted-foreground">Generating...</span>
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

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Custom prompt */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && customPrompt.trim()) generate(customPrompt); }}
          placeholder="Ask about this control..."
          className="flex-1 px-3 py-1.5 rounded-lg border bg-background text-xs"
          disabled={streamStatus === 'streaming'}
        />
        <Button
          size="sm"
          onClick={() => { if (customPrompt.trim()) generate(customPrompt); }}
          disabled={!customPrompt.trim() || streamStatus === 'streaming'}
          className="shrink-0 text-xs px-3"
        >
          Ask
        </Button>
      </div>

      {/* Provider vault */}
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

