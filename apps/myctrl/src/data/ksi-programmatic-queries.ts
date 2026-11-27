// Programmatic query suggestions for FedRAMP 20x Key Security Indicators (KSIs)
// Maps each KSI to 2-5 tools with realistic CLI commands for evidence collection
//
// NOTE: src/data/ksi-programmatic-queries.json is the source of truth for the
// query content. This module is a thin typed accessor over that JSON.

import type { KSIProgrammaticQuery } from './types';
import ksiProgrammaticQueriesJson from './ksi-programmatic-queries.json';

const KSI_PROGRAMMATIC_QUERIES_DATA: KSIProgrammaticQuery[] =
  (ksiProgrammaticQueriesJson as unknown as { queries: KSIProgrammaticQuery[] }).queries;

// ============================================================================
// Lookup Index (built once, O(1) access)
// ============================================================================

let _queryIndex: Map<string, KSIProgrammaticQuery> | null = null;

function ensureIndex() {
  if (_queryIndex) return;
  _queryIndex = new Map();
  for (const query of KSI_PROGRAMMATIC_QUERIES_DATA) {
    _queryIndex.set(query.ksiId, query);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get programmatic query suggestions for a KSI by its control ID
 */
export function getKSIProgrammaticQueries(ksiId: string): KSIProgrammaticQuery | undefined {
  ensureIndex();
  return _queryIndex!.get(ksiId);
}

/**
 * Check if a KSI has programmatic query suggestions
 */
export function hasKSIProgrammaticQueries(ksiId: string): boolean {
  ensureIndex();
  return _queryIndex!.has(ksiId);
}

/**
 * Export the full data array for iteration
 */
export const KSI_PROGRAMMATIC_QUERIES = KSI_PROGRAMMATIC_QUERIES_DATA;
