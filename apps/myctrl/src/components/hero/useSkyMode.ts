import { useSyncExternalStore } from 'react';
import { getSkyMode, subscribeSkyMode, type SkyMode } from '@/lib/cosmos/sky-mode';

const getServerSnapshot = (): SkyMode => 'drift';

/** The visitor's sky preference, kept in sync across islands and tabs. */
export function useSkyMode(): SkyMode {
  return useSyncExternalStore(subscribeSkyMode, getSkyMode, getServerSnapshot);
}
