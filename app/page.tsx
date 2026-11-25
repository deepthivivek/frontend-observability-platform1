'use client';

import React, { Suspense, useState } from 'react';
import { AppShell } from '@/src/components/layout/AppShell';
import { StatCards } from '@/src/components/StatCards';
import { PerformanceChart } from '@/src/components/PerformanceChart';
import { UrlSyncedEndpointTable } from '@/src/components/UrlSyncedEndpointTable';
import {
  DashboardEmptyState,
  DashboardErrorAlert,
  DashboardLoadingSkeleton,
} from '@/src/components/DashboardStateViews';
import { useDashboardMetrics } from '@/src/hooks/useDashboardMetrics';
import type { Timeframe } from '@/src/lib/metrics';

function OverviewContent() {
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');
  const { data, isLoading, isError, error, refetch } = useDashboardMetrics(timeframe);

  const isEmpty =
    !isLoading &&
    !isError &&
    data !== undefined &&
    data.stats.length === 0 &&
    data.performanceData.length === 0 &&
    data.endpoints.length === 0;

  return (
    <AppShell
      title="Overview"
      subtitle="API telemetry overview, performance series, and endpoint health"
      isSynthetic={data?.isSynthetic ?? true}
      endpoints={data?.endpoints ?? []}
    >
      {isLoading && <DashboardLoadingSkeleton />}

      {isError && (
        <DashboardErrorAlert
          message={error?.message || 'Unable to load dashboard metrics.'}
          onRetry={() => {
            void refetch();
          }}
        />
      )}

      {isEmpty && <DashboardEmptyState />}

      {!isLoading && !isError && data && !isEmpty && (
        <>
          <StatCards stats={data.stats} endpoints={data.endpoints} />
          <PerformanceChart
            data={data.performanceData}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
          <UrlSyncedEndpointTable endpoints={data.endpoints} />
        </>
      )}
    </AppShell>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Overview" subtitle="Loading telemetry overview...">
          <DashboardLoadingSkeleton />
        </AppShell>
      }
    >
      <OverviewContent />
    </Suspense>
  );
}
