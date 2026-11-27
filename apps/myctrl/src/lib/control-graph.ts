/**
 * Control ID helpers for enhancement/base relationships (compare tools).
 */

/**
 * Parse a control ID to extract the parent ID (if it's an enhancement)
 * AC-2(1) -> AC-2
 * AC-2(10) -> AC-2
 * AC-2 -> null (already a base control)
 */
export function parseParentControlId(controlId: string): string | null {
  const match = controlId.match(/^([A-Z]{2}-\d+)\(\d+\)$/);
  if (match) {
    return match[1];
  }
  return null;
}

/** Check if a control ID is a base control (not an enhancement) */
export function isBaseControl(controlId: string): boolean {
  return !controlId.includes('(');
}

/** Check if a control ID is an enhancement */
export function isEnhancement(controlId: string): boolean {
  return controlId.includes('(');
}
