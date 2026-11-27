/**
 * Normalize a control ID for dedup grouping.
 * Strips zero-padding, paren spacing, and lowercases.
 * AC-02 → ac-2, AC-2 (01) → ac-2(1), AC-02(01) → ac-2(1)
 */
export function normalizeControlId(controlId: string): string {
  return controlId
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/([a-z]+)-0+(\d)/g, '$1-$2')
    .replace(/\(0+(\d+)\)/g, '($1)');
}
