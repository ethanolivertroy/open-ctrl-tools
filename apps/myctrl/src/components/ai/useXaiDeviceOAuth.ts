import { useCallback, useRef, useState } from 'react';
import {
  runXaiDeviceLoginFlow,
  type XaiDeviceAuthorization,
} from '@/lib/ai/xai-oauth';
import type { ProviderOAuthTokens } from '@/lib/storage-types';

export type XaiOAuthUiStatus = 'idle' | 'starting' | 'waiting' | 'connected' | 'error';

interface UseXaiDeviceOAuthOptions {
  /** Persist the tokens; the hook flips to `connected` only after this resolves. */
  persistTokens: (tokens: ProviderOAuthTokens) => Promise<void>;
}

/**
 * UI state machine for the xAI device-code sign-in flow. A generation counter
 * abandons in-flight polls whenever the flow is reset, restarted, or the
 * settings dialog closes.
 */
export function useXaiDeviceOAuth({ persistTokens }: UseXaiDeviceOAuthOptions) {
  const [status, setStatus] = useState<XaiOAuthUiStatus>('idle');
  const [device, setDevice] = useState<XaiDeviceAuthorization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  /** Abandon any in-flight poll without touching the visible state. */
  const invalidate = useCallback(() => {
    generation.current += 1;
  }, []);

  /** Abandon any in-flight poll and reset the visible state. */
  const reset = useCallback((nextStatus: XaiOAuthUiStatus = 'idle') => {
    generation.current += 1;
    setStatus(nextStatus);
    setDevice(null);
    setError(null);
  }, []);

  /** Reflect an already-persisted session (e.g. loaded from storage). */
  const markConnected = useCallback(() => {
    setStatus('connected');
  }, []);

  const start = useCallback(async () => {
    const gen = ++generation.current;
    setStatus('starting');
    setDevice(null);
    setError(null);

    try {
      const result = await runXaiDeviceLoginFlow({
        isCancelled: () => generation.current !== gen,
        onDevice: (nextDevice) => {
          setDevice(nextDevice);
          setStatus('waiting');
          window.open(
            nextDevice.verificationUriComplete || nextDevice.verificationUri,
            '_blank',
            'noopener,noreferrer',
          );
        },
      });

      if (generation.current !== gen || result.status === 'cancelled') return;

      if (result.status === 'complete') {
        await persistTokens(result.tokens);
        setStatus('connected');
        setDevice(null);
        setError(null);
        return;
      }

      setStatus('error');
      setError(result.message);
    } catch (err) {
      if (generation.current !== gen) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not start X Premium sign-in.');
    }
  }, [persistTokens]);

  return { status, device, error, start, reset, invalidate, markConnected };
}
