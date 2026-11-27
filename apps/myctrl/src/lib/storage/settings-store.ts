import { getDb } from '../db';
import type { MyCtrlDB } from '../db-runtime';

export type NavigationScope = 'all' | 'family';

const DEFAULT_NAVIGATION_SCOPE: NavigationScope = 'all';

async function openDb(): Promise<MyCtrlDB> {
  return getDb();
}

export async function getParameterOverrideEnabled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const db = await openDb();
    return (await db.settings.get('param-override-enabled'))?.value === 'true';
  } catch {
    return false;
  }
}

export async function setParameterOverrideEnabled(enabled: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.settings.put({ key: 'param-override-enabled', value: enabled ? 'true' : 'false' });
}

export async function getNavigationScope(): Promise<NavigationScope> {
  if (typeof window === 'undefined') return DEFAULT_NAVIGATION_SCOPE;
  try {
    const db = await openDb();
    return (await db.settings.get('nav-scope'))?.value === 'family' ? 'family' : DEFAULT_NAVIGATION_SCOPE;
  } catch {
    return DEFAULT_NAVIGATION_SCOPE;
  }
}

export async function setNavigationScope(scope: NavigationScope): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  await db.settings.put({ key: 'nav-scope', value: scope });
}
