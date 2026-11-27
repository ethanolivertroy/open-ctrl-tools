/**
 * AIViewBuilder Component
 *
 * Main component for building AI-powered compliance views.
 * Handles streaming responses and renders the generated UI.
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type View } from '@/lib/json-render/catalog';
import {
  getAIDataPreference,
  setAIDataPreference,
  getAIDataSummary,
  type AIContext,
} from '@/lib/ai-data-context';
import { PROVIDERS } from '@/lib/ai/providers';
import { APIKeyPrompt } from './APIKeyDialog';
import { ProviderVault } from './ProviderVault';
import { ProviderSelector } from './ProviderSelector';
import { StructuredViewRenderer } from './StructuredViewRenderer';
import { useAIProviderState } from './useAIProviderState';
import { AIViewActions } from './AIViewActions';
import { useAIViewBuilderState } from './useAIViewBuilderState';
import { Sparkles, Send, Loader2, AlertCircle, X, RefreshCw, Settings } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface AIViewBuilderProps {
  /** Initial context from the current page */
  context?: AIContext;
  /** Example prompts to display */
  examplePrompts?: ExamplePrompt[];
  /** Callback when view is generated */
  onViewGenerated?: (view: View) => void;
  /** Compact mode for slide panels */
  compact?: boolean;
  /** Initial prompt (e.g., from URL parameter) */
  initialPrompt?: string;
  /** Saved view to reopen */
  initialSavedViewId?: string;
}

interface ExamplePrompt {
  label: string;
  prompt: string;
  category?: string;
}

const TEXT_ONLY_BANNER_SESSION_KEY = 'myctrl.ai.text-only-banner-dismissed';

// ============================================================================
// Default Example Prompts
// ============================================================================

const DEFAULT_EXAMPLES: ExamplePrompt[] = [
  {
    label: 'FedRAMP Moderate Overview',
    prompt: 'Show me the key FedRAMP Moderate controls for access management',
    category: 'Federal',
  },
  {
    label: 'AI Governance Frameworks',
    prompt: 'What AI governance frameworks should I consider and how do they compare?',
    category: 'AI',
  },
  {
    label: 'Privacy Controls Comparison',
    prompt: 'Compare GDPR and CCPA privacy requirements',
    category: 'Privacy',
  },
  {
    label: 'Incident Response Controls',
    prompt: 'Show me incident response controls across NIST 800-53 and ISO 27001',
    category: 'Enterprise',
  },
  {
    label: 'CMMC Level 2 Readiness',
    prompt: 'What controls do I need for CMMC Level 2 certification?',
    category: 'Defense',
  },
  {
    label: 'Based on My Favorites',
    prompt: 'Create a view based on my favorite frameworks showing common control areas',
    category: 'Personalized',
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function AIViewBuilder({
  context,
  examplePrompts = DEFAULT_EXAMPLES,
  onViewGenerated,
  compact = false,
  initialPrompt,
  initialSavedViewId,
}: AIViewBuilderProps) {
  const [includeUserData, setIncludeUserData] = useState(false);
  const [showDataToggle, setShowDataToggle] = useState(true);
  const [isTextOnlyBannerDismissed, setIsTextOnlyBannerDismissed] = useState(false);
  const {
    hasProvider: hasApiKey,
    activeProvider,
    setActiveProvider,
    activeModel,
    setActiveModel,
    isVaultOpen,
    setIsVaultOpen,
    refreshProviderState,
  } = useAIProviderState({ loadActiveModel: true });

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    prompt,
    setPrompt,
    status,
    view,
    error,
    streamedContent,
    effectiveContext,
    submitPrompt,
    cancelGeneration,
    retryGeneration,
    resetBuilder,
  } = useAIViewBuilderState({
    context,
    initialPrompt,
    initialSavedViewId,
    onViewGenerated,
    activeProvider,
    activeModel,
    includeUserData,
  });

  // Load data preference on mount
  useEffect(() => {
    getAIDataPreference().then(pref => {
      setIncludeUserData(pref === 'always');
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsTextOnlyBannerDismissed(
      window.sessionStorage.getItem(TEXT_ONLY_BANNER_SESSION_KEY) === '1',
    );
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  // Handle example prompt click
  const handleExampleClick = useCallback((example: ExamplePrompt) => {
    setPrompt(example.prompt);
    textareaRef.current?.focus();
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    cancelGeneration();
  }, [cancelGeneration]);

  // Handle retry
  const handleRetry = useCallback(() => {
    retryGeneration();
  }, [retryGeneration]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitPrompt();
    }
  }, [submitPrompt]);

  // Toggle user data preference
  const handleToggleUserData = useCallback(() => {
    const newValue = !includeUserData;
    setIncludeUserData(newValue);
    setAIDataPreference(newValue ? 'always' : 'never'); // fire-and-forget
  }, [includeUserData]);

  // Get user data summary for display
  const [dataSummary, setDataSummary] = useState<string[]>([]);
  useEffect(() => {
    getAIDataSummary().then(setDataSummary);
  }, []);

  // Show provider setup prompt if no providers configured
  if (!hasApiKey) {
    return (
      <>
        <div className={`space-y-6 ${compact ? '' : 'max-w-4xl mx-auto'}`}>
          <APIKeyPrompt onOpenSettings={() => setIsVaultOpen(true)} />
        </div>
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
    <div className={`space-y-6 ${compact ? '' : 'max-w-4xl mx-auto'}`}>
      {/* Input Section */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Header with provider selector and settings */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">AI View Builder</span>
              </div>
              <div className="flex items-center gap-1">
                <ProviderSelector
                  activeProvider={activeProvider}
                  activeModel={activeModel}
                  onProviderChange={(providerId, model) => {
                    setActiveProvider(providerId);
                    setActiveModel(model);
                  }}
                />
                <button
                  onClick={() => setIsVaultOpen(true)}
                  className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title="Provider Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Prompt Input */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Describe the compliance view you want to create..."
                className="w-full min-h-[100px] max-h-[200px] p-4 pr-12 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={status === 'generating' || status === 'streaming'}
              />
              <button
                onClick={status === 'generating' || status === 'streaming' ? handleCancel : () => submitPrompt()}
                disabled={!prompt.trim() && status === 'idle'}
                className="absolute bottom-4 right-4 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={status === 'generating' || status === 'streaming' ? 'Cancel' : 'Generate (⌘+Enter)'}
              >
                {status === 'generating' || status === 'streaming' ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* User Data Toggle */}
            {showDataToggle && dataSummary.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="include-data"
                    checked={includeUserData}
                    onChange={handleToggleUserData}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                  />
                  <label htmlFor="include-data" className="text-sm cursor-pointer">
                    <span className="text-foreground">Include my data</span>
                    <span className="text-muted-foreground ml-2">
                      ({dataSummary.join(', ')})
                    </span>
                  </label>
                </div>
                <button
                  onClick={() => setShowDataToggle(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Text-only model info banner */}
            {(() => {
              const prov = PROVIDERS[activeProvider];
              const mdl = prov?.models.find(m => m.id === activeModel);
              if (mdl && !mdl.supportsStructuredOutput && status === 'idle' && !isTextOnlyBannerDismissed) {
                return (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-500">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1">
                      This model produces text responses. For interactive control views, use a 2B+ model or cloud provider.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTextOnlyBannerDismissed(true);
                        if (typeof window !== 'undefined') {
                          window.sessionStorage.setItem(TEXT_ONLY_BANNER_SESSION_KEY, '1');
                        }
                      }}
                      className="rounded p-0.5 hover:bg-amber-500/10 transition-colors"
                      aria-label="Dismiss text-only model notice"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* Status Indicator */}
            {status !== 'idle' && status !== 'complete' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {status === 'understanding' && 'Understanding your request...'}
                  {status === 'generating' && 'Generating view...'}
                  {status === 'streaming' && 'Building components...'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Example Prompts */}
      {status === 'idle' && !view && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Try an example:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {examplePrompts.map((example, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(example)}
                className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {example.label}
                  </span>
                  {example.category && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {example.category}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {example.prompt}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && error && (
        <Card className="bg-red-500/5 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
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
          </CardContent>
        </Card>
      )}

      {/* Generated View */}
      {view && (
        <div className="space-y-4">
          {/* View Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{view.title}</h2>
              {view.description && (
                <p className="text-sm text-muted-foreground mt-1">{view.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Generated
              </Badge>
              <AIViewActions view={view} prompt={prompt} context={effectiveContext} />
            </div>
          </div>

          {/* View Components — rendered via json-render Renderer */}
          <StructuredViewRenderer view={view} />

          {/* Refinement Input */}
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Refine this view... (e.g., 'Add more detail' or 'Focus on encryption')"
                  className="flex-1 p-2 rounded border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      setPrompt(`${prompt}\n\nRefinement: ${e.currentTarget.value.trim()}`);
                      e.currentTarget.value = '';
                      submitPrompt(`${prompt}\n\nRefinement: ${e.currentTarget.value.trim()}`);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    resetBuilder({ clearPrompt: true });
                  }}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Start over
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Streaming Preview (for debugging/development): raw LLM stream tail,
          not a code block - intentionally outside the CodeBlock mandate. */}
      {status === 'streaming' && streamedContent && (
        <Card className="bg-muted/30 border-border">
          <CardContent className="p-4">
            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap overflow-hidden max-h-40">
              {streamedContent.slice(-500)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
    <ProviderVault
      isOpen={isVaultOpen}
      onClose={() => setIsVaultOpen(false)}
      onProvidersChanged={refreshProviderState}
    />
    </>
  );
}

export default AIViewBuilder;
