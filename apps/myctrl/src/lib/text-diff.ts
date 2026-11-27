import diff from 'fast-diff';

export interface DiffSegment {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

const MAX_LENGTH = 10_000;

/**
 * Compute word-level diff between two strings.
 * Returns segments for each side (left = deletions, right = insertions).
 */
export function computeDiff(textA: string, textB: string): {
  left: DiffSegment[];
  right: DiffSegment[];
  truncated: boolean;
} {
  const truncated = textA.length > MAX_LENGTH || textB.length > MAX_LENGTH;
  const a = truncated ? textA.slice(0, MAX_LENGTH) : textA;
  const b = truncated ? textB.slice(0, MAX_LENGTH) : textB;

  if (!a && !b) {
    return { left: [], right: [], truncated };
  }

  const result = diff(a, b);

  const left: DiffSegment[] = [];
  const right: DiffSegment[] = [];

  for (const [op, text] of result) {
    if (op === diff.EQUAL) {
      left.push({ type: 'equal', text });
      right.push({ type: 'equal', text });
    } else if (op === diff.DELETE) {
      left.push({ type: 'delete', text });
    } else if (op === diff.INSERT) {
      right.push({ type: 'insert', text });
    }
  }

  return { left, right, truncated };
}
