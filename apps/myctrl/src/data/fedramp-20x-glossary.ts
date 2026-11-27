/**
 * FedRAMP FRMR Glossary — defined term lookup for KSI term badges.
 *
 * Provides case-insensitive lookup by term name or alt-name.
 * Data sourced from FRMR.documentation.json FRD.data.both section.
 */

import glossaryData from './fedramp-20x-glossary.json';

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  alts: string[];
  note: string | null;
  reference?: string;
  referenceUrl?: string;
}

// Lazy-initialized lookup index (term name + alts → GlossaryTerm)
let termIndex: Map<string, GlossaryTerm> | null = null;

function buildIndex(): Map<string, GlossaryTerm> {
  const index = new Map<string, GlossaryTerm>();
  const terms = (glossaryData as any).terms as Record<string, any>;

  for (const entry of Object.values(terms)) {
    const term: GlossaryTerm = {
      id: entry.id,
      term: entry.term,
      definition: entry.definition,
      alts: entry.alts || [],
      note: entry.note || null,
      reference: entry.reference || undefined,
      referenceUrl: entry.referenceUrl || undefined,
    };

    // Index by exact name
    index.set(term.term.toLowerCase(), term);

    // Index by alt names
    for (const alt of term.alts) {
      index.set(alt.toLowerCase(), term);
    }
  }

  return index;
}

function getIndex(): Map<string, GlossaryTerm> {
  if (!termIndex) {
    termIndex = buildIndex();
  }
  return termIndex;
}

/** Look up a term definition by name (case-insensitive, supports alt names). */
export function getTermDefinition(term: string): GlossaryTerm | undefined {
  return getIndex().get(term.toLowerCase());
}

/** Check if a term has a definition in the glossary. */
export function hasTermDefinition(term: string): boolean {
  return getIndex().has(term.toLowerCase());
}
