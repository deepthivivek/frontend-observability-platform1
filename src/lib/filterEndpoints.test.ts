import { describe, it, expect } from 'vitest';
import {
  calculateDashboardSummary,
  filterAndSortEndpoints,
  sanitizeSortDirection,
  sanitizeStatusFilter,
} from './filterEndpoints';
import type { EndpointRow } from './metrics';

const FIXTURE_ENDPOINTS: EndpointRow[] = [
  {
    id: '1',
    name: 'Auth Token',
    method: 'POST',
    path: '/api/v1/auth/login',
    status: 'Healthy',
    responseTimeMs: 120,
    uptimePercent: 99.98,
    lastChecked: '2026-11-24T11:00:00Z',
  },
  {
    id: '2',
    name: 'Checkout Gateway',
    method: 'POST',
    path: '/api/v2/payments/settle',
    status: 'Failed',
    responseTimeMs: 750,
    uptimePercent: 95.5,
    lastChecked: '2026-11-24T11:01:00Z',
  },
  {
    id: '3',
    name: 'Vector Search',
    method: 'GET',
    path: '/api/v1/traces/query',
    status: 'Warning',
    responseTimeMs: 310,
    uptimePercent: 99.1,
    lastChecked: '2026-11-24T11:02:00Z',
  },
  {
    id: '4',
    name: 'Health Ping',
    method: 'GET',
    path: '/api/healthz',
    status: 'Healthy',
    responseTimeMs: 18,
    uptimePercent: 100,
    lastChecked: '2026-11-24T11:03:00Z',
  },
];

describe('filterAndSortEndpoints', () => {
  it('filters case-insensitively across name, path, and method', () => {
    expect(
      filterAndSortEndpoints(FIXTURE_ENDPOINTS, {
        query: 'checkout',
        status: 'All',
        sort: 'none',
      }).map((e) => e.id)
    ).toEqual(['2']);

    expect(
      filterAndSortEndpoints(FIXTURE_ENDPOINTS, {
        query: '/traces/',
        status: 'All',
        sort: 'none',
      }).map((e) => e.id)
    ).toEqual(['3']);

    expect(
      filterAndSortEndpoints(FIXTURE_ENDPOINTS, {
        query: 'get',
        status: 'All',
        sort: 'none',
      }).map((e) => e.id)
    ).toEqual(['3', '4']);
  });

  it('filters by status and combines with search query', () => {
    expect(
      filterAndSortEndpoints(FIXTURE_ENDPOINTS, {
        query: '',
        status: 'Healthy',
        sort: 'none',
      }).map((e) => e.id)
    ).toEqual(['1', '4']);

    expect(
      filterAndSortEndpoints(FIXTURE_ENDPOINTS, {
        query: 'health',
        status: 'Failed',
        sort: 'none',
      })
    ).toEqual([]);
  });

  it('sorts by responseTimeMs ascending and descending without mutating original array', () => {
    const snapshot = [...FIXTURE_ENDPOINTS];

    const asc = filterAndSortEndpoints(FIXTURE_ENDPOINTS, {
      query: '',
      status: 'All',
      sort: 'asc',
    });
    expect(asc.map((e) => e.responseTimeMs)).toEqual([18, 120, 310, 750]);

    const desc = filterAndSortEndpoints(FIXTURE_ENDPOINTS, {
      query: '',
      status: 'All',
      sort: 'desc',
    });
    expect(desc.map((e) => e.responseTimeMs)).toEqual([750, 310, 120, 18]);

    expect(FIXTURE_ENDPOINTS).toEqual(snapshot);
  });
});

describe('calculateDashboardSummary', () => {
  it('computes counts, rounded healthyRatePercent, and averageResponseTimeMs', () => {
    const summary = calculateDashboardSummary(FIXTURE_ENDPOINTS.slice(0, 3));
    expect(summary).toEqual({
      totalEndpoints: 3,
      healthyCount: 1,
      warningCount: 1,
      failedCount: 1,
      healthyRatePercent: 33.3,
      averageResponseTimeMs: 393,
    });
  });

  it('handles empty endpoint lists safely without NaN', () => {
    expect(calculateDashboardSummary([])).toEqual({
      totalEndpoints: 0,
      healthyCount: 0,
      warningCount: 0,
      failedCount: 0,
      healthyRatePercent: 0,
      averageResponseTimeMs: 0,
    });
  });
});

describe('URL query sanitizers', () => {
  it('sanitizes invalid status and sort strings safely', () => {
    expect(sanitizeStatusFilter('Warning')).toBe('Warning');
    expect(sanitizeStatusFilter('BogusStatus')).toBe('All');
    expect(sanitizeStatusFilter(null)).toBe('All');

    expect(sanitizeSortDirection('asc')).toBe('asc');
    expect(sanitizeSortDirection('desc')).toBe('desc');
    expect(sanitizeSortDirection('random')).toBe('none');
    expect(sanitizeSortDirection(undefined)).toBe('none');
  });
});
