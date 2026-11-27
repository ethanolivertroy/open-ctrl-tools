import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from '@/lib/json-render/catalog';
import type { AIContext } from '@/lib/ai-data-context';
import type { ProviderId } from '@/lib/ai/providers';
import { generateAIView } from '@/lib/services/ai-view-generation';
import { loadSavedViewRuntime } from '@/lib/services/saved-view-runtime';

export type GenerationStatus = 'idle' | 'understanding' | 'generating' | 'streaming' | 'complete' | 'error';

interface UseAIViewBuilderStateOptions {
  context?: AIContext;
  initialPrompt?: string;
  initialSavedViewId?: string;
  onViewGenerated?: (view: View) => void;
  activeProvider: ProviderId;
  activeModel?: string;
  includeUserData: boolean;
}

interface ResetBuilderOptions {
  clearPrompt?: boolean;
}

export function useAIViewBuilderState({
  context,
  initialPrompt,
  initialSavedViewId,
  onViewGenerated,
  activeProvider,
  activeModel,
  includeUserData,
}: UseAIViewBuilderStateOptions) {
  const [resolvedInitialPrompt, setResolvedInitialPrompt] = useState(initialPrompt);
  const [resolvedInitialSavedViewId, setResolvedInitialSavedViewId] = useState(initialSavedViewId);
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedContext, setLoadedContext] = useState<AIContext | undefined>();
  const [streamedContent, setStreamedContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const effectiveContext = useMemo(
    () => ({ ...loadedContext, ...context }),
    [loadedContext, context],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    setResolvedInitialPrompt(initialPrompt ?? params.get('prompt') ?? undefined);
    setResolvedInitialSavedViewId(initialSavedViewId ?? params.get('savedView') ?? undefined);
  }, [initialPrompt, initialSavedViewId]);

  useEffect(() => {
    setPrompt(resolvedInitialPrompt || '');
    setHasAutoSubmitted(false);
    if (resolvedInitialPrompt) {
      setView(null);
      setStatus('idle');
      setError(null);
    }
  }, [resolvedInitialPrompt]);

  useEffect(() => {
    if (!resolvedInitialSavedViewId) {
      setLoadedContext(undefined);
      return;
    }

    let cancelled = false;

    const loadSavedView = async () => {
      try {
        const savedViewRuntime = await loadSavedViewRuntime(resolvedInitialSavedViewId);
        if (!savedViewRuntime) {
          if (!cancelled) {
            setError('Saved view not found.');
            setStatus('error');
          }
          return;
        }
        if (cancelled) return;

        setLoadedContext(savedViewRuntime.context);
        setPrompt(savedViewRuntime.savedView.prompt);
        setView(savedViewRuntime.view);
        setStatus('complete');
        setError(null);
        onViewGenerated?.(savedViewRuntime.view);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load saved view.');
        setStatus('error');
      }
    };

    setView(null);
    setStatus('generating');
    void loadSavedView();

    return () => {
      cancelled = true;
    };
  }, [resolvedInitialSavedViewId, onViewGenerated]);

  const submitPrompt = useCallback(async (nextPrompt?: string) => {
    const promptValue = (nextPrompt ?? prompt).trim();
    if (!promptValue || status === 'generating' || status === 'streaming') return;

    setError(null);
    setView(null);
    setStreamedContent('');
    setStatus('understanding');

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const generatedView = await generateAIView({
        prompt: promptValue,
        context: effectiveContext,
        includeUserData,
        providerId: activeProvider,
        activeModel,
        signal: abortControllerRef.current.signal,
        onStatusChange: setStatus,
        onStream: setStreamedContent,
      });
      setView(generatedView);
      setStatus('complete');
      onViewGenerated?.(generatedView);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatus('error');
    }
  }, [
    prompt,
    status,
    effectiveContext,
    includeUserData,
    activeProvider,
    activeModel,
    onViewGenerated,
  ]);

  useEffect(() => {
    if (resolvedInitialPrompt && !resolvedInitialSavedViewId && !hasAutoSubmitted && status === 'idle') {
      setHasAutoSubmitted(true);
      const timer = setTimeout(() => {
        void submitPrompt(resolvedInitialPrompt);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [resolvedInitialPrompt, resolvedInitialSavedViewId, hasAutoSubmitted, status, submitPrompt]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('idle');
  }, []);

  const retryGeneration = useCallback(() => {
    void submitPrompt();
  }, [submitPrompt]);

  const resetBuilder = useCallback((options?: ResetBuilderOptions) => {
    abortControllerRef.current?.abort();
    setView(null);
    setError(null);
    setStreamedContent('');
    setStatus('idle');
    if (options?.clearPrompt) {
      setPrompt('');
    }
  }, []);

  return {
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
  };
}
