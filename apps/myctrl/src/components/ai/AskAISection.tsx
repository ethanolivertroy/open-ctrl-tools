/**
 * AskAISection Component
 *
 * A compact AI prompt section for control detail pages.
 * Shows AI responses inline on the same page.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Sparkles, ChevronRight, Send, Loader2, X, RefreshCw, AlertCircle, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AISlidePanel } from './AISlidePanel';
import { APIKeyPrompt } from './APIKeyDialog';
import { ProviderVault } from './ProviderVault';
import { StructuredViewRenderer } from './StructuredViewRenderer';
import { useAIProviderState } from './useAIProviderState';
import { useAITextGeneration } from './useAITextGeneration';
import { ViewSchema, type View, generateSystemPrompt } from '@/lib/json-render/catalog';
import { parseStructuredViewResponse } from '@/lib/ai/structured-view';
import { adaptPromptForProvider } from '@/lib/ai/prompt-adapters';
import { wrapTextInView } from '@/lib/ai/view-utils';
import type { AIContext } from '@/lib/ai-data-context';

interface AskAISectionProps {
  /** Framework ID for context */
  frameworkId: string;
  /** Control ID for context */
  controlId: string;
  /** Quick question suggestions */
  quickQuestions?: string[];
}

const DEFAULT_QUICK_QUESTIONS = [
  'How does this map to other frameworks?',
  'What evidence is needed for this control?',
  'Show related controls in this family',
];

type GenerationStatus = 'idle' | 'generating' | 'streaming' | 'complete' | 'error';

export function AskAISection({
  frameworkId,
  controlId,
  quickQuestions = DEFAULT_QUICK_QUESTIONS,
}: AskAISectionProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [view, setView] = useState<View | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<string>('');
  const {
    hasProvider: hasApiKey,
    activeProvider,
    isVaultOpen,
    setIsVaultOpen,
    refreshProviderState,
  } = useAIProviderState();

  const context: AIContext = {
    frameworkId,
    controlId,
  };
  const systemPrompt = activeProvider === 'ollama'
    ? adaptPromptForProvider(generateSystemPrompt(context), 'ollama')
    : generateSystemPrompt(context);
  const {
    error,
    requestText,
    clearOutput,
  } = useAITextGeneration({
    activeProvider,
    systemPrompt,
    context,
    defaultModel: activeProvider === 'transformers'
      ? 'Xenova/Phi-3-mini-4k-instruct'
      : undefined,
    timeoutMs: 45000,
  });

  const startGeneration = useCallback(async (prompt: string) => {
    if (!prompt.trim() || status === 'generating' || status === 'streaming') return;

    // Reset state
    setView(null);
    setActiveQuestion(prompt);
    setStatus('generating');

    const fullPrompt = `For control ${controlId}: ${prompt.trim()}`;

    setStatus('streaming');
    const fullContent = await requestText(fullPrompt);
    if (!fullContent) {
      setStatus('idle');
      return;
    }

    const result = parseStructuredViewResponse(fullContent);
    if (result.view) {
      setView(result.view);
    } else {
      setView(wrapTextInView(fullContent));
    }
    setStatus('complete');
  }, [controlId, requestText, status]);

  const handleQuestionClick = useCallback((question: string) => {
    startGeneration(question);
  }, [startGeneration]);

  const handleCustomSubmit = useCallback(() => {
    if (customPrompt.trim()) {
      startGeneration(customPrompt.trim());
      setCustomPrompt('');
    }
  }, [customPrompt, startGeneration]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomSubmit();
    }
  }, [handleCustomSubmit]);

  const handleClear = useCallback(() => {
    clearOutput();
    setView(null);
    setStatus('idle');
    setActiveQuestion('');
  }, [clearOutput]);

  const handleRetry = useCallback(() => {
    if (activeQuestion) {
      startGeneration(activeQuestion);
    }
  }, [activeQuestion, startGeneration]);

  const isLoading = status === 'generating' || status === 'streaming';
  const hasResponse = view !== null || error !== null;

  // Show API key prompt if no key is configured
  if (!hasApiKey) {
    return (
      <>
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Ask AI</h3>
            </div>
            <APIKeyPrompt onOpenSettings={() => setIsVaultOpen(true)} compact />
          </CardContent>
        </Card>
        <ProviderVault
          isOpen={isVaultOpen}
          onClose={() => setIsVaultOpen(false)}
          onProvidersChanged={refreshProviderState}
        />
      </>
    );
  }

  return (
    <>
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Ask AI</h3>
          </div>
          <div className="flex items-center gap-2">
            {hasResponse && (
              <button
                onClick={handleClear}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setIsVaultOpen(true)}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Provider Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Questions - hide when we have a response */}
        {!hasResponse && !isLoading && (
          <div className="space-y-2">
            {quickQuestions.map((question, i) => (
              <button
                key={i}
                onClick={() => handleQuestionClick(question)}
                className="w-full flex items-center justify-between p-2 rounded-lg border border-border bg-background/50 hover:bg-background hover:border-primary/30 transition-colors text-left group"
              >
                <span className="text-sm text-muted-foreground group-hover:text-foreground">
                  {question}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Custom Prompt Input - hide when we have a response */}
        {!hasResponse && !isLoading && (
          <div className="flex gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask something specific..."
              className="flex-1 p-2 rounded-lg border border-border bg-background/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customPrompt.trim()}
              className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-background/50">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{activeQuestion}</p>
              <p className="text-xs text-muted-foreground">
                {status === 'generating' ? 'Understanding your request...' : 'Building response...'}
              </p>
            </div>
            <button
              onClick={handleClear}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && error && (
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-400">{error}</p>
                <button
                  onClick={handleRetry}
                  className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generated Response */}
        {view && status === 'complete' && (
          <div className="space-y-4">
            {/* Response Header */}
            <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-background/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">{activeQuestion}</span>
                </div>
                <h4 className="font-medium">{view.title}</h4>
                {view.description && (
                  <p className="text-sm text-muted-foreground mt-1">{view.description}</p>
                )}
              </div>
              <button
                onClick={handleClear}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                title="Clear response"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Response Components — rendered via json-render Renderer */}
            <StructuredViewRenderer view={view} />

            {/* Follow-up Input */}
            <div className="pt-2 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask a follow-up..."
                  className="flex-1 p-2 rounded-lg border border-border bg-background/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customPrompt.trim()}
                  className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    <ProviderVault
      isOpen={isVaultOpen}
      onClose={() => setIsVaultOpen(false)}
      onProvidersChanged={refreshProviderState}
    />
    </>
  );
}

/**
 * Compact AI button for framework headers
 */
interface AIViewButtonProps {
  frameworkId: string;
  className?: string;
}

export function AIViewButton({ frameworkId, className }: AIViewButtonProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const context: AIContext = {
    frameworkId,
  };

  return (
    <>
      <button
        onClick={() => setIsPanelOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-sm ${className || ''}`}
      >
        <Sparkles className="w-4 h-4" />
        AI View
      </button>

      <AISlidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        context={context}
      />
    </>
  );
}

export default AskAISection;
