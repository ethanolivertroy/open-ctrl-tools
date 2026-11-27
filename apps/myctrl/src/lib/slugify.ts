/**
 * Convert a control ID to a URL-safe slug. Canonical implementation shared by
 * the data layer (src/data/controls.ts) and the worker API layer, which must
 * not import the data layer (it would drag every framework JSON into the
 * worker bundle).
 *
 * AC-2 -> ac-2
 * AC-2(1) -> ac-2-1
 * 1.1.1 -> 1-1-1
 * IR-07 -> ir-7 (strips leading zeros)
 */
export function slugifyControlId(controlId: string): string {
  return controlId
    .toLowerCase()
    .replace(/\((\d+)\)/g, '-$1')  // AC-2(1) -> ac-2-1
    .replace(/\./g, '-')           // 1.1.1 -> 1-1-1
    .replace(/[^a-z0-9-]/g, '-')   // Replace non-alphanumeric
    .replace(/-+/g, '-')           // Collapse multiple dashes
    .replace(/^-|-$/g, '')         // Trim leading/trailing dashes
    .replace(/-0+(\d)/g, '-$1');   // Strip leading zeros: ir-07 -> ir-7
}
