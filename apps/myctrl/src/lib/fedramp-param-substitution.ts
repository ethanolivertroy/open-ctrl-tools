/**
 * FedRAMP Parameter Substitution Logic
 *
 * Maps FedRAMP-specific parameter values to [Assignment: ...] and [Selection: ...]
 * placeholders in NIST 800-53 control descriptions.
 *
 * Parameter key formats:
 * - Letter-based (base controls): "(c) (1): value" -> section c, sub-item 1
 * - Number-based (enhancement controls): "(3) (d): value" -> enhancement param, sub-section d
 *
 * The mapping works by:
 * 1. Parsing the description to locate each placeholder and its structural position
 *    (which letter section and numbered sub-item it appears in)
 * 2. Parsing the FedRAMP parameter string to get key-value pairs
 * 3. Matching parameter keys to placeholder positions
 * 4. Replacing by character offset (not by text match) to handle duplicate placeholders
 */

/** A parsed FedRAMP parameter entry */
interface ParsedParam {
  /** Primary marker - letter for base controls, number for enhancements */
  primary: string;
  /** Secondary marker - number for letter-primary, letter for number-primary */
  secondary?: string;
  /** The parameter value */
  value: string;
}

/** A located placeholder in the description with its character offset */
interface LocatedPlaceholder {
  /** Start offset in the full description string */
  start: number;
  /** End offset (exclusive) in the full description string */
  end: number;
  /** Type: assignment or selection */
  type: 'assignment' | 'selection';
  /** Letter section this placeholder appears in (a, b, c...) */
  letter?: string;
  /** Numbered sub-item within the letter section (1, 2, 3...) */
  number?: string;
  /** Parenthesized sub-letter: (a), (b), etc. within a section */
  subLetter?: string;
}

/**
 * Parse FedRAMP parameter string into structured entries.
 * Handles formats like:
 *   "(c) (1): at least every 3 years"
 *   "(j): at least annually"
 *   "(3): 24 hours for user accounts"
 *   "(3) (d): ninety (90) days"
 */
function parseParams(paramText: string): ParsedParam[] {
  const params: ParsedParam[] = [];
  const lines = paramText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match: (primary) optional-(secondary): value
    // Primary can be a letter or number, secondary can be a number or letter
    const match = trimmed.match(/^\(([a-z]|\d+)\)(?:\s*\(([a-z]|\d+)\))?\s*:\s*(.+)$/);
    if (match) {
      params.push({
        primary: match[1],
        secondary: match[2] || undefined,
        value: match[3].trim(),
      });
    }
  }

  return params;
}

/**
 * Locate all [Assignment: ...] and [Selection: ...] placeholders in a description,
 * tracking their structural position and character offset.
 */
function locatePlaceholders(description: string): LocatedPlaceholder[] {
  const placeholders: LocatedPlaceholder[] = [];
  const lines = description.split('\n');

  let currentLetter: string | undefined;
  let currentNumber: string | undefined;
  let currentSubLetter: string | undefined;
  let offset = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed) {
      // Check for top-level letter item: "a. ..."
      const letterMatch = trimmed.match(/^([a-z])\.\s/);
      if (letterMatch) {
        currentLetter = letterMatch[1];
        currentNumber = undefined;
        currentSubLetter = undefined;
      }

      // Check for numbered sub-item: "1. ..."
      const numberMatch = trimmed.match(/^(\d+)\.\s/);
      if (numberMatch) {
        currentNumber = numberMatch[1];
        currentSubLetter = undefined;
      }

      // Check for parenthesized sub-letter: "(a) ..." within a section
      const subLetterMatch = trimmed.match(/^\(([a-z])\)\s/);
      if (subLetterMatch) {
        currentSubLetter = subLetterMatch[1];
      }
    }

    // Find all placeholders in this line using offsets in the original string
    const placeholderRegex = /\[(Assignment|Selection)(?:\s*\([^)]*\))?:\s*[^\]]+\]/g;
    let pMatch;
    while ((pMatch = placeholderRegex.exec(line)) !== null) {
      placeholders.push({
        start: offset + pMatch.index,
        end: offset + pMatch.index + pMatch[0].length,
        type: pMatch[1].toLowerCase() as 'assignment' | 'selection',
        letter: currentLetter,
        number: currentNumber,
        subLetter: currentSubLetter,
      });
    }

    offset += line.length + 1; // +1 for the newline
  }

  return placeholders;
}

/**
 * Determine if a control ID is an enhancement (e.g., "AC-2 (03)").
 */
function isEnhancement(controlId: string): boolean {
  return /\(\d+\)/.test(controlId);
}

/**
 * Build a list of (offset, replacement) pairs for parameter substitution.
 *
 * Strategy:
 * For base controls (e.g., AC-1):
 *   - Param "(c) (1)" matches the 1st placeholder in section c, sub-item 1
 *   - Param "(c)" with no secondary matches the 1st placeholder in section c
 *   - Param "(j)" matches the 1st placeholder in section j
 *
 * For enhancement controls (e.g., AC-2(03)):
 *   - Param "(3) (d)" matches a placeholder in sub-section (d)
 *   - Param "(3)" with no secondary matches remaining placeholders sequentially
 */
function buildSubstitutions(
  description: string,
  paramText: string,
  controlId: string,
): { start: number; end: number; value: string }[] {
  const params = parseParams(paramText);
  const placeholders = locatePlaceholders(description);
  const results: { start: number; end: number; value: string }[] = [];

  if (params.length === 0 || placeholders.length === 0) return results;

  const enhancement = isEnhancement(controlId);
  const usedPlaceholders = new Set<number>();
  const usedParams = new Set<number>();

  if (enhancement) {
    // First pass: match params with sub-letter secondary to placeholders
    // with matching subLetter or letter
    for (let pi = 0; pi < params.length; pi++) {
      const param = params[pi];
      if (param.secondary && /^[a-z]$/.test(param.secondary)) {
        for (let ph = 0; ph < placeholders.length; ph++) {
          if (usedPlaceholders.has(ph)) continue;
          const placeholder = placeholders[ph];
          if (placeholder.subLetter === param.secondary || placeholder.letter === param.secondary) {
            results.push({ start: placeholder.start, end: placeholder.end, value: param.value });
            usedPlaceholders.add(ph);
            usedParams.add(pi);
            break;
          }
        }
      }
    }

    // Second pass: match params with number-secondary to placeholders
    // with matching numbered sub-item
    for (let pi = 0; pi < params.length; pi++) {
      if (usedParams.has(pi)) continue;
      const param = params[pi];
      if (param.secondary && /^\d+$/.test(param.secondary)) {
        for (let ph = 0; ph < placeholders.length; ph++) {
          if (usedPlaceholders.has(ph)) continue;
          const placeholder = placeholders[ph];
          if (placeholder.number === param.secondary) {
            results.push({ start: placeholder.start, end: placeholder.end, value: param.value });
            usedPlaceholders.add(ph);
            usedParams.add(pi);
            break;
          }
        }
      }
    }

    // Third pass: assign remaining params sequentially to remaining placeholders
    const remainingParams = params.filter((_, i) => !usedParams.has(i));
    const remainingPlaceholderIndices = placeholders
      .map((_, i) => i)
      .filter(i => !usedPlaceholders.has(i));

    for (let i = 0; i < Math.min(remainingParams.length, remainingPlaceholderIndices.length); i++) {
      const ph = placeholders[remainingPlaceholderIndices[i]];
      results.push({ start: ph.start, end: ph.end, value: remainingParams[i].value });
    }
  } else {
    // For base controls, params use letter-primary keys
    for (const param of params) {
      const targetLetter = param.primary;
      const targetNumber = param.secondary;

      for (let ph = 0; ph < placeholders.length; ph++) {
        if (usedPlaceholders.has(ph)) continue;
        const placeholder = placeholders[ph];

        if (placeholder.letter === targetLetter) {
          if (targetNumber) {
            if (placeholder.number === targetNumber) {
              results.push({ start: placeholder.start, end: placeholder.end, value: param.value });
              usedPlaceholders.add(ph);
              break;
            }
          } else {
            results.push({ start: placeholder.start, end: placeholder.end, value: param.value });
            usedPlaceholders.add(ph);
            break;
          }
        }
      }
    }
  }

  return results;
}

/**
 * Apply parameter substitutions to a description string.
 * Returns the new description with placeholders replaced by FedRAMP values.
 * Substituted values are wrapped in {{FEDRAMP:value}} markers for the renderer.
 *
 * Uses offset-based replacement to correctly handle duplicate placeholder text.
 */
export function substituteParameters(
  description: string,
  paramText: string,
  controlId: string,
): string {
  const substitutions = buildSubstitutions(description, paramText, controlId);

  if (substitutions.length === 0) return description;

  // Sort by offset descending so we can replace from end to start
  // without invalidating earlier offsets
  substitutions.sort((a, b) => b.start - a.start);

  let result = description;
  for (const sub of substitutions) {
    result =
      result.slice(0, sub.start) +
      `{{FEDRAMP:${sub.value}}}` +
      result.slice(sub.end);
  }

  return result;
}

/**
 * Get the best (highest) baseline parameters for a FedRAMP control.
 * Priority: high > moderate > low
 */
export function getBestBaselineParams(baselines: {
  low?: { included: boolean; fedramp_parameters?: string | null };
  moderate?: { included: boolean; fedramp_parameters?: string | null };
  high?: { included: boolean; fedramp_parameters?: string | null };
}): { level: string; params: string } | null {
  if (baselines.high?.included && baselines.high.fedramp_parameters) {
    return { level: 'High', params: baselines.high.fedramp_parameters };
  }
  if (baselines.moderate?.included && baselines.moderate.fedramp_parameters) {
    return { level: 'Moderate', params: baselines.moderate.fedramp_parameters };
  }
  if (baselines.low?.included && baselines.low.fedramp_parameters) {
    return { level: 'Low', params: baselines.low.fedramp_parameters };
  }
  return null;
}
