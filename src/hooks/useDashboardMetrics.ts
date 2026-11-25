'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  fetchDashboardMetrics,
  type DashboardMetrics,
  type Timeframe,
} from '@/src/lib/metrics';

export function useDashboardMetrics(timeframe: Timeframe = '24h') {
  const searchParams = useSearchParams();
  const simulateError = searchParams.get('simulateError') === '1';
  const empty = searchParams.get('empty') === '1';

  return useQuery<DashboardMetrics, Error>({
    queryKey: ['dashboard-metrics', { simulateError, empty, timeframe }],
    queryFn: () => fetchDashboardMetrics({ simulateError, empty, timeframe }),
  });
}
