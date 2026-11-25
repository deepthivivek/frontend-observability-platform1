'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { AppShell } from '@/src/components/layout/AppShell';
import {
  DashboardEmptyState,
  DashboardErrorAlert,
  DashboardLoadingSkeleton,
} from '@/src/components/DashboardStateViews';
import { useDashboardMetrics } from '@/src/hooks/useDashboardMetrics';

function AnomaliesContent() {
  const { data, isLoading, isError, error, refetch } = useDashboardMetrics('24h');
  const endpoints = data?.endpoints ?? [];
  const isEmpty = !isLoading && !isError && data !== undefined && endpoints.length === 0;

  const anomalies = endpoints.filter(
    (ep) => ep.status === 'Failed' || ep.status === 'Warning'
  );

  return (
    <AppShell
      title="Anomalies"
      subtitle="Active SLA breaches, elevated latency warnings, and failing endpoints"
      isSynthetic={data?.isSynthetic ?? true}
      endpoints={endpoints}
    >
      {isLoading && <DashboardLoadingSkeleton />}

      {isError && (
        <DashboardErrorAlert
          message={error?.message || 'Unable to load anomaly diagnostics.'}
          onRetry={() => {
            void refetch();
          }}
        />
      )}

      {isEmpty && <DashboardEmptyState />}

      {!isLoading && !isError && data && !isEmpty && (
        <section aria-label="Detected anomalies" className="space-y-4">
          {anomalies.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <h2 className="text-base font-semibold text-customText">
                No Active Anomalies Detected
              </h2>
              <p className="text-xs text-mutedText max-w-md">
                All {endpoints.length} monitored API endpoints are currently healthy and within latency SLO budgets.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {anomalies.map((ep) => {
                const isFailed = ep.status === 'Failed';
                return (
                  <article
                    key={ep.id}
                    className={`glass-card rounded-2xl p-5 border space-y-3 ${
                      isFailed ? 'border-rose-500/40' : 'border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {isFailed ? (
                          <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <h2 className="text-sm font-semibold text-customText truncate">
                            {ep.name}
                          </h2>
                          <p className="text-xs font-mono text-mutedText truncate">
                            {ep.method} {ep.path}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold border ${
                          isFailed
                            ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                            : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {ep.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs font-mono tabular-nums pt-2 border-t border-subtleBorder">
                      <div>
                        <span className="text-mutedText block">Latency</span>
                        <span className="text-customText font-semibold">
                          {ep.responseTimeMs} ms
                        </span>
                      </div>
                      <div>
                        <span className="text-mutedText block">Uptime</span>
                        <span className="text-customText font-semibold">
                          {ep.uptimePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <Link
                        href={`/endpoints?status=${ep.status}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
                      >
                        <span>Inspect in Endpoints</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}

export default function AnomaliesPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Anomalies" subtitle="Loading anomaly diagnostics...">
          <DashboardLoadingSkeleton />
        </AppShell>
      }
    >
      <AnomaliesContent />
    </Suspense>
  );
}
