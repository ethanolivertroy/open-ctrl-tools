/**
 * AISlidePanel Component
 *
 * A slide-over panel for contextual AI interactions.
 * Opens from the right side and provides a compact AI view builder.
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, ExternalLink, Settings } from 'lucide-react';
import { AIViewBuilder } from './AIViewBuilder';
import { ProviderVault } from './ProviderVault';
import { useAIProviderState } from './useAIProviderState';
import type { AIContext } from '@/lib/ai-data-context';

interface AISlidePanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Context from the current page */
  context?: AIContext;
  /** Pre-filled prompt */
  initialPrompt?: string;
  /** Saved view to reopen */
  initialSavedViewId?: string;
}

export function AISlidePanel({
  isOpen,
  onClose,
  context,
  initialPrompt,
  initialSavedViewId,
}: AISlidePanelProps) {
  const {
    hasProvider: hasApiKey,
    isVaultOpen,
    setIsVaultOpen,
    refreshProviderState,
  } = useAIProviderState();

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 w-full sm:w-[600px] md:w-[700px] lg:w-[800px] bg-background border-l border-border z-50 shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="AI View Builder"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">AI View Builder</h2>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/build"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Open in full page
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => setIsVaultOpen(true)}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Provider Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AIViewBuilder
            context={context}
            compact={true}
            initialPrompt={initialPrompt}
            initialSavedViewId={initialSavedViewId}
            examplePrompts={getContextualExamples(context)}
          />
        </div>

        {/* Provider Settings */}
        <ProviderVault
          isOpen={isVaultOpen}
          onClose={() => setIsVaultOpen(false)}
          onProvidersChanged={refreshProviderState}
        />
      </div>
    </>
  );
}

/**
 * Get contextual example prompts based on the current page context
 */
function getContextualExamples(context?: AIContext) {
  if (!context) {
    return undefined; // Use default examples
  }

  const examples = [];

  if (context.frameworkId) {
    examples.push({
      label: 'Key Controls',
      prompt: `Show me the most important controls in ${context.frameworkId}`,
      category: 'Overview',
    });
    examples.push({
      label: 'Cross-References',
      prompt: `How does ${context.frameworkId} map to other frameworks?`,
      category: 'Mapping',
    });
  }

  if (context.assessmentId) {
    examples.push({
      label: 'Assessment Summary',
      prompt: 'Show the latest gap assessment summary and priority gaps for this assessment',
      category: 'Assessment',
    });
    examples.push({
      label: 'Family Hotspots',
      prompt: 'Which control families need the most work in this assessment?',
      category: 'Assessment',
    });
    examples.push({
      label: 'Remediation Plan',
      prompt: 'Build a remediation-focused view for the open gaps in this assessment',
      category: 'Remediation',
    });
  }

  // Trust center prompts for FedRAMP 20x KSI
  if (context.frameworkId === 'fedramp-20x-ksi') {
    examples.push({
      label: 'Assessment Areas',
      prompt: 'Show 20x assessment focus areas for this KSI',
      category: 'Assessment',
    });
    examples.push({
      label: 'CLI Commands',
      prompt: 'What CLI commands can verify this KSI?',
      category: 'Evidence',
    });
    examples.push({
      label: 'Trust Center',
      prompt: 'Generate a trust center layout for this KSI',
      category: 'Trust Center',
    });
    examples.push({
      label: 'Trust Center Plan',
      prompt: 'Build a complete trust center covering all 60 KSIs',
      category: 'Trust Center',
    });
  }

  if (context.controlId) {
    examples.push({
      label: 'Similar Controls',
      prompt: `Find controls similar to ${context.controlId} in other frameworks`,
      category: 'Comparison',
    });
    examples.push({
      label: 'Implementation',
      prompt: `What do I need to implement ${context.controlId}?`,
      category: 'Implementation',
    });
  }

  if (context.family) {
    examples.push({
      label: `${context.family} Family`,
      prompt: `Show me all ${context.family} controls with their baselines`,
      category: 'Family',
    });
  }

  // Add a generic comparison if we have context
  if (context.frameworkId) {
    examples.push({
      label: 'Compare to ISO',
      prompt: `Compare ${context.frameworkId} controls to ISO 27001`,
      category: 'Comparison',
    });
  }

  return examples.length > 0 ? examples : undefined;
}

/**
 * Hook to manage the AI slide panel state
 */
export function useAISlidePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<AIContext | undefined>();
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>();
  const [initialSavedViewId, setInitialSavedViewId] = useState<string | undefined>();

  const open = useCallback((ctx?: AIContext, prompt?: string, savedViewId?: string) => {
    setContext(ctx);
    setInitialPrompt(prompt);
    setInitialSavedViewId(savedViewId);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    context,
    initialPrompt,
    initialSavedViewId,
    open,
    close,
  };
}

export default AISlidePanel;
