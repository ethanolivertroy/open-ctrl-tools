import { describe, expect, it } from 'vitest';
import type { View } from '@/lib/json-render/catalog';
import { buildInitialViewData, resolveControlListFilters } from '@/lib/json-render/view-runtime';

describe('json-render view runtime helpers', () => {
  it('merges bound control list filters over static defaults', () => {
    const merged = resolveControlListFilters(
      { family: 'AC', baseline: 'moderate' },
      { baseline: 'high', searchQuery: 'crypto' },
    );

    expect(merged).toEqual({
      family: 'AC',
      baseline: 'high',
      searchQuery: 'crypto',
    });
  });

  it('builds initial provider data from bound components', () => {
    const view: View = {
      title: 'Bound dashboard',
      components: [
        {
          type: 'Section',
          title: 'Filters',
          children: [
            {
              type: 'ControlList',
              frameworkId: 'fedramp-rev5',
              filterDataPath: '/filters',
              filters: {
                baseline: 'moderate',
                family: 'AC',
              },
              groupBy: 'none',
              variant: 'compact',
              limit: 10,
            },
            {
              type: 'ProgressGauge',
              label: 'Coverage',
              dataPath: '/stats/coverage',
              value: 72,
              max: 100,
              variant: 'bar',
              showValue: true,
            },
          ],
        },
      ],
    };

    expect(buildInitialViewData(view)).toEqual({
      filters: {
        baseline: 'moderate',
        family: 'AC',
      },
      stats: {
        coverage: 72,
      },
    });
  });
});
