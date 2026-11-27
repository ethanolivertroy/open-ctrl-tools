import type { ImplementationStatus } from '@/lib/db';

export type AssessmentGroupKey = 'status' | 'family' | 'owner' | 'none';

export interface GroupableAssessmentItem {
  status: ImplementationStatus;
  family: string;
  owner?: string;
}

export interface GroupItemsConfig {
  /** Label used for the single group when groupBy is 'none'. */
  defaultLabel: string;
  /** Sort order applied when grouping by status. */
  statusOrder: readonly ImplementationStatus[];
}

/** Status order used by the gaps list and evidence queue. */
export const DEFAULT_STATUS_GROUP_ORDER: readonly ImplementationStatus[] = [
  'not-assessed',
  'not-implemented',
  'partially-implemented',
  'planned',
  'implemented',
  'not-applicable',
];

/** Remediation surfaces the most actionable statuses first. */
export const REMEDIATION_STATUS_GROUP_ORDER: readonly ImplementationStatus[] = [
  'not-implemented',
  'partially-implemented',
  'planned',
  'not-assessed',
  'implemented',
  'not-applicable',
];

/**
 * Group assessment items for display. Family and owner groups are sorted
 * alphabetically; status groups follow the configured status order. Items
 * grouped by owner fall back to 'Unassigned' when no owner is set.
 */
export function groupItemsBy<T extends GroupableAssessmentItem>(
  items: T[],
  groupBy: AssessmentGroupKey,
  config: GroupItemsConfig,
): Array<[string, T[]]> {
  if (groupBy === 'none') {
    return [[config.defaultLabel, items]];
  }

  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = groupBy === 'family'
      ? item.family
      : groupBy === 'owner'
        ? item.owner || 'Unassigned'
        : item.status;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const entries = Array.from(groups.entries());
  if (groupBy === 'family' || groupBy === 'owner') {
    return entries.sort((left, right) => left[0].localeCompare(right[0]));
  }

  return entries.sort(
    (left, right) =>
      config.statusOrder.indexOf(left[0] as ImplementationStatus)
      - config.statusOrder.indexOf(right[0] as ImplementationStatus),
  );
}
