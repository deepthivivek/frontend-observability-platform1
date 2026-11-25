'use client';

import React, { Suspense } from 'react';
import { AppShell } from '@/src/components/layout/AppShell';
import { UrlSyncedEndpointTable } from '@/src/components/UrlSyncedEndpointTable';
import {
  DashboardEmptyState,
  DashboardErrorAlert,
  DashboardLoadingSkeleton,
} from '@/src/components/DashboardStateViews';
import { useDashboardMetrics } from '@/src/hooks/useDashboardMetrics';
import { calculateDashboardSummary } from '@/src/lib/filterEndpoints';

function EndpointsContent() {
  const { data, isLoading, isError, error, refetch } = useDashboardMetrics('24h');
  const endpoints = data?.endpoints ?? [];
  const summary = calculateDashboardSummary(endpoints);
  const isEmpty = !isLoading && !isError && data !== undefined && endpoints.length === 0;

  return (
    <AppShell
      title="Endpoints"
      subtitle="Search, status-filter, and sort monitored API routes by response latency"
      isSynthetic={data?.isSynthetic ?? true}
      endpoints={endpoints}
    >
      {isLoading && <DashboardLoadingSkeleton />}

      {isError && (
        <DashboardErrorAlert
          message={error?.message || 'Unable to load endpoint inventory.'}
          onRetry={() => {
            void refetch();
          }}
        />
      )}

      {isEmpty && <DashboardEmptyState />}

      {!isLoading && !isError && data && !isEmpty && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-4">
              <div className="text-xs text-mutedText">Total Endpoints</div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-customText mt-1">
                {summary.totalEndpoints}
              </div>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <div className="text-xs text-mutedText">Healthy Rate</div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-emerald-400 mt-1">
                {summary.healthyRatePercent.toFixed(1)}%
              </div>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <div className="text-xs text-mutedText">Avg Response Time</div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-cyan-400 mt-1">
                {summary.averageResponseTimeMs} ms
              </div>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <div className="text-xs text-mutedText">Degraded / Failing</div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-rose-400 mt-1">
                {summary.warningCount + summary.failedCount}
              </div>
            </div>
          </div>

          <UrlSyncedEndpointTable endpoints={endpoints} />
        </>
      )}
    </AppShell>
  );
}

export default function EndpointsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Endpoints" subtitle="Loading monitored API endpoints...">
          <DashboardLoadingSkeleton />
        </AppShell>
      }
    >
      <EndpointsContent />
    </Suspense>
  );
}
