import type { EndpointRow, EndpointStatus } from './metrics';

export type EndpointStatusFilter = 'All' | EndpointStatus;
export type SortDirection = 'none' | 'asc' | 'desc';

export interface EndpointFilterOptions {
  query: string;
  status: EndpointStatusFilter;
  sort: SortDirection;
}

export interface DashboardSummary {
  totalEndpoints: number;
  healthyCount: number;
  warningCount: number;
  failedCount: number;
  healthyRatePercent: number;
  averageResponseTimeMs: number;
}

const VALID_STATUS_FILTERS: ReadonlySet<string> = new Set([
  'All',
  'Healthy',
  'Warning',
  'Failed',
]);

const VALID_SORT_DIRECTIONS: ReadonlySet<string> = new Set([
  'none',
  'asc',
  'desc',
]);

export function sanitizeStatusFilter(value: string | null | undefined): EndpointStatusFilter {
  if (value && VALID_STATUS_FILTERS.has(value)) {
    return value as EndpointStatusFilter;
  }
  return 'All';
}

export function sanitizeSortDirection(value: string | null | undefined): SortDirection {
  if (value && VALID_SORT_DIRECTIONS.has(value)) {
    return value as SortDirection;
  }
  return 'none';
}

export function filterAndSortEndpoints(
  endpoints: readonly EndpointRow[],
  options: EndpointFilterOptions
): EndpointRow[] {
  const normalizedQuery = options.query.trim().toLowerCase();

  const filtered = endpoints.filter((endpoint) => {
    if (options.status !== 'All' && endpoint.status !== options.status) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (
      endpoint.name.toLowerCase().includes(normalizedQuery) ||
      endpoint.path.toLowerCase().includes(normalizedQuery) ||
      endpoint.method.toLowerCase().includes(normalizedQuery)
    );
  });

  if (options.sort === 'none') {
    return [...filtered];
  }

  return [...filtered].sort((a, b) =>
    options.sort === 'asc'
      ? a.responseTimeMs - b.responseTimeMs
      : b.responseTimeMs - a.responseTimeMs
  );
}

export function calculateDashboardSummary(
  endpoints: readonly EndpointRow[]
): DashboardSummary {
  const totalEndpoints = endpoints.length;

  if (totalEndpoints === 0) {
    return {
      totalEndpoints: 0,
      healthyCount: 0,
      warningCount: 0,
      failedCount: 0,
      healthyRatePercent: 0,
      averageResponseTimeMs: 0,
    };
  }

  let healthyCount = 0;
  let warningCount = 0;
  let failedCount = 0;
  let totalResponseTimeMs = 0;

  for (const endpoint of endpoints) {
    if (endpoint.status === 'Healthy') {
      healthyCount += 1;
    } else if (endpoint.status === 'Warning') {
      warningCount += 1;
    } else if (endpoint.status === 'Failed') {
      failedCount += 1;
    }
    totalResponseTimeMs += endpoint.responseTimeMs;
  }

  const healthyRatePercent = Math.round((healthyCount / totalEndpoints) * 1000) / 10;
  const averageResponseTimeMs = Math.round(totalResponseTimeMs / totalEndpoints);

  return {
    totalEndpoints,
    healthyCount,
    warningCount,
    failedCount,
    healthyRatePercent,
    averageResponseTimeMs,
  };
}
