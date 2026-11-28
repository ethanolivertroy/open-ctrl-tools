/**
 * Cancellation for voice sessions that are still connecting.
 *
 * Starting a session is slow and stateful: a permission prompt, a token
 * exchange, a socket or peer connection. If the user ends the session (or the
 * view unmounts) part-way through, whatever has already been acquired — most
 * importantly the microphone — must be released, even though the caller never
 * received a transport it could stop.
 */

export function createAbortError(): Error {
  return new DOMException('Voice session was cancelled before it connected.', 'AbortError');
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

/** Settle with `promise`, or reject with an AbortError as soon as `signal` aborts. */
export function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}
