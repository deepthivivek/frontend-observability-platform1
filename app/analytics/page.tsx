'use client';

import React, { Suspense, useState } from 'react';
import { AppShell } from '@/src/components/layout/AppShell';
import { StatCards } from '@/src/components/StatCards';
import { PerformanceChart } from '@/src/components/PerformanceChart';
import {
  DashboardEmptyState,
  DashboardErrorAlert,
  DashboardLoadingSkeleton,
} from '@/src/components/DashboardStateViews';
import { useDashboardMetrics } from '@/src/hooks/useDashboardMetrics';
import type { Timeframe } from '@/src/lib/metrics';

function AnalyticsContent() {
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');
  const { data, isLoading, isError, error, refetch } = useDashboardMetrics(timeframe);
  const isEmpty =
    !isLoading &&
    !isError &&
    data !== undefined &&
    data.performanceData.length === 0 &&
    data.stats.length === 0;

  return (
    <AppShell
      title="Analytics"
      subtitle="Multi-window latency, throughput, and error rate analysis"
      isSynthetic={data?.isSynthetic ?? true}
      endpoints={data?.endpoints ?? []}
    >
      {isLoading && <DashboardLoadingSkeleton />}

      {isError && (
        <DashboardErrorAlert
          message={error?.message || 'Unable to load analytics metrics.'}
          onRetry={() => {
            void refetch();
          }}
        />
      )}

      {isEmpty && <DashboardEmptyState />}

      {!isLoading && !isError && data && !isEmpty && (
        <>
          <PerformanceChart
            data={data.performanceData}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
          <StatCards stats={data.stats} endpoints={data.endpoints} />

          <section
            aria-label="Time-series snapshot table"
            className="glass-card rounded-2xl p-5 space-y-3"
          >
            <h2 className="text-sm font-semibold text-customText">
              Rolling Window Telemetry Points ({timeframe})
            </h2>
            <div className="overflow-x-auto rounded-xl border border-subtleBorder">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-subtleBorder bg-elevated/60 text-xs uppercase tracking-wider text-mutedText">
                    <th scope="col" className="py-2.5 px-4 font-semibold">
                      Bucket
                    </th>
                    <th scope="col" className="py-2.5 px-4 font-semibold">
                      Latency (ms)
                    </th>
                    <th scope="col" className="py-2.5 px-4 font-semibold">
                      Requests
                    </th>
                    <th scope="col" className="py-2.5 px-4 font-semibold">
                      Error Rate (%)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtleBorder font-mono text-xs tabular-nums">
                  {data.performanceData.map((point) => (
                    <tr key={point.timestamp} className="hover:bg-elevated/40">
                      <td className="py-2.5 px-4 text-customText">{point.label}</td>
                      <td className="py-2.5 px-4 text-indigo-300">{point.latencyMs} ms</td>
                      <td className="py-2.5 px-4 text-cyan-300">
                        {point.requests.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-rose-300">
                        {point.errorRate.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Analytics" subtitle="Loading performance analytics...">
          <DashboardLoadingSkeleton />
        </AppShell>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
