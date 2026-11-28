/**
 * The visitor's preference for the homepage sky, shared between the canvas
 * and its controls (two separate islands) through localStorage and an event.
 */

export type SkyMode = 'drift' | 'still' | 'off';

export const SKY_MODES: readonly SkyMode[] = ['drift', 'still', 'off'];
export const SKY_STORAGE_KEY = 'myctrl-sky-mode';

const SKY_EVENT = 'myctrl:sky-mode';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function isSkyMode(value: unknown): value is SkyMode {
  return value === 'drift' || value === 'still' || value === 'off';
}

/**
 * An explicit choice always wins. Without one the sky drifts, unless the
 * visitor has asked their system for reduced motion — then it holds still.
 */
export function resolveSkyMode(stored: string | null | undefined, prefersReducedMotion: boolean): SkyMode {
  if (isSkyMode(stored)) return stored;
  return prefersReducedMotion ? 'still' : 'drift';
}

export function getSkyMode(): SkyMode {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(SKY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (privacy mode); fall through to the default.
  }
  return resolveSkyMode(stored, window.matchMedia(REDUCED_MOTION_QUERY).matches);
}

export function setSkyMode(mode: SkyMode): void {
  try {
    window.localStorage.setItem(SKY_STORAGE_KEY, mode);
  } catch {
    // Still announce the change so this page updates even if it cannot persist.
  }
  window.dispatchEvent(new CustomEvent(SKY_EVENT, { detail: mode }));
}

export function subscribeSkyMode(listener: () => void): () => void {
  const motion = window.matchMedia(REDUCED_MOTION_QUERY);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SKY_STORAGE_KEY) listener();
  };
  window.addEventListener(SKY_EVENT, listener);
  window.addEventListener('storage', onStorage);
  motion.addEventListener('change', listener);
  return () => {
    window.removeEventListener(SKY_EVENT, listener);
    window.removeEventListener('storage', onStorage);
    motion.removeEventListener('change', listener);
  };
}
