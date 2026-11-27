/**
 * AI Data Context
 *
 * Aggregates user data for AI prompts when the user opts in.
 * This provides context about the user's favorites, notes, and recently viewed items.
 */

import {
  getFavoriteFrameworks,
} from './storage/favorites-store';
import { getAllControlNotes } from './storage/control-note-store';
import { getRecentlyViewed } from './storage/recently-viewed-store';
import { getDb } from './db';

// ============================================================================
// Types
// ============================================================================

export interface FavoriteWithNote {
  frameworkId: string;
  notes?: string;
}

export interface AIUserData {
  favorites: string[];
  favoritesWithNotes: FavoriteWithNote[];
  noteCount: number;
  recentlyViewed: string[];
  controlNotesFrameworks: string[]; // Frameworks where user has taken notes
}

export interface EnhancedAIUserData extends AIUserData {
  summary: string; // Human-readable summary for AI prompt
}

export type AIDataPreference = 'always' | 'never' | 'ask';

// ============================================================================
// User Data Aggregation
// ============================================================================

/**
 * Get aggregated user data for AI context
 * Returns null if user has opted out or hasn't opted in
 */
export async function getAIUserData(): Promise<AIUserData | null> {
  if (typeof window === 'undefined') return null;

  const preference = await getAIDataPreference();
  if (preference === 'never') return null;

  const favorites = await getFavoriteFrameworks();
  const controlNotes = await getAllControlNotes();
  const recentItems = await getRecentlyViewed();

  // Get unique frameworks where user has notes
  const notedFrameworks = [...new Set(controlNotes.map(n => n.frameworkId))];

  return {
    favorites: favorites.map(f => f.frameworkId),
    favoritesWithNotes: favorites
      .filter(f => f.notes)
      .map(f => ({ frameworkId: f.frameworkId, notes: f.notes })),
    noteCount: controlNotes.length,
    controlNotesFrameworks: notedFrameworks,
    recentlyViewed: recentItems
      .slice(0, 10)
      .map(r => r.controlSlug ? `${r.frameworkId}:${r.controlSlug}` : r.frameworkId),
  };
}

/**
 * Get enhanced user data with a summary string for AI prompts
 */
export async function getEnhancedAIUserData(): Promise<EnhancedAIUserData | null> {
  const data = await getAIUserData();
  if (!data) return null;

  const summaryParts: string[] = [];

  if (data.favorites.length > 0) {
    summaryParts.push(`Favorites: ${data.favorites.join(', ')}`);
  }

  if (data.favoritesWithNotes.length > 0) {
    const noteParts = data.favoritesWithNotes.map(f => `${f.frameworkId}: "${f.notes}"`);
    summaryParts.push(`Notes on favorites: ${noteParts.join('; ')}`);
  }

  if (data.recentlyViewed.length > 0) {
    summaryParts.push(`Recently viewed: ${data.recentlyViewed.slice(0, 5).join(', ')}`);
  }

  if (data.controlNotesFrameworks.length > 0) {
    summaryParts.push(`Has notes on controls in: ${data.controlNotesFrameworks.join(', ')}`);
  }

  return {
    ...data,
    summary: summaryParts.join('. '),
  };
}

/**
 * Check if user data should be included based on preference
 */
export async function shouldIncludeUserData(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const preference = await getAIDataPreference();
  return preference === 'always';
}

/**
 * Check if we should prompt the user about including data
 */
export async function shouldAskAboutUserData(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  const preference = await getAIDataPreference();
  return preference === 'ask' || preference === null;
}

// ============================================================================
// Preference Management
// ============================================================================

/**
 * Get the user's AI data sharing preference
 */
export async function getAIDataPreference(): Promise<AIDataPreference | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await getDb();
    const setting = await db.settings.get('ai-data-pref');
    const stored = setting?.value;
    if (stored === 'always' || stored === 'never' || stored === 'ask') {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set the user's AI data sharing preference
 */
export async function setAIDataPreference(preference: AIDataPreference): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await getDb();
  await db.settings.put({ key: 'ai-data-pref', value: preference });
}

/**
 * Clear the user's AI data preference (returns to 'ask' state)
 */
export async function clearAIDataPreference(): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await getDb();
  await db.settings.delete('ai-data-pref');
}

// ============================================================================
// Data Summary for Display
// ============================================================================

/**
 * Get a human-readable summary of user data that would be shared
 */
export async function getAIDataSummary(): Promise<string[]> {
  if (typeof window === 'undefined') return [];

  const data = await getAIUserData();
  if (!data) return [];

  const summary: string[] = [];

  if (data.favorites.length > 0) {
    summary.push(`${data.favorites.length} favorite framework${data.favorites.length === 1 ? '' : 's'}`);
  }

  if (data.noteCount > 0) {
    summary.push(`${data.noteCount} control note${data.noteCount === 1 ? '' : 's'}`);
  }

  if (data.recentlyViewed.length > 0) {
    summary.push(`${data.recentlyViewed.length} recently viewed item${data.recentlyViewed.length === 1 ? '' : 's'}`);
  }

  return summary;
}

// ============================================================================
// Context Building
// ============================================================================

export interface AIContext {
  frameworkId?: string;
  controlId?: string;
  family?: string;
  assessmentId?: string;
  baseline?: string;
  systemName?: string;
}

/**
 * Build the complete AI request context from page context and user data
 */
export async function buildAIRequestContext(
  pageContext?: AIContext,
  includeUserData?: boolean
): Promise<{
  context?: AIContext;
  includeUserData: boolean;
  userData?: AIUserData;
}> {
  const shouldInclude = includeUserData ?? await shouldIncludeUserData();
  const userData = shouldInclude ? await getAIUserData() : undefined;

  return {
    context: pageContext,
    includeUserData: shouldInclude,
    userData: userData || undefined,
  };
}
