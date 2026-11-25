'use client';

import React, { Suspense, useState } from 'react';
import { Search, X } from 'lucide-react';
import { AppShell } from '@/src/components/layout/AppShell';
import {
  DashboardEmptyState,
  DashboardErrorAlert,
  DashboardLoadingSkeleton,
} from '@/src/components/DashboardStateViews';
import { useDashboardMetrics } from '@/src/hooks/useDashboardMetrics';
import type { EndpointRow } from '@/src/lib/metrics';

function mapStatusToHttpCode(status: EndpointRow['status']): number {
  if (status === 'Healthy') return 200;
  if (status === 'Warning') return 429;
  return 503;
}

function LogsContent() {
  const [logSearch, setLogSearch] = useState('');
  const { data, isLoading, isError, error, refetch } = useDashboardMetrics('24h');
  const endpoints = data?.endpoints ?? [];
  const isEmpty = !isLoading && !isError && data !== undefined && endpoints.length === 0;

  const normalizedQuery = logSearch.trim().toLowerCase();
  const filteredLogs = endpoints.filter((ep) => {
    if (!normalizedQuery) return true;
    const code = String(mapStatusToHttpCode(ep.status));
    return (
      ep.name.toLowerCase().includes(normalizedQuery) ||
      ep.path.toLowerCase().includes(normalizedQuery) ||
      ep.method.toLowerCase().includes(normalizedQuery) ||
      code.includes(normalizedQuery)
    );
  });

  return (
    <AppShell
      title="Request Logs"
      subtitle="Live probe execution logs derived from monitored API endpoints"
      isSynthetic={data?.isSynthetic ?? true}
      endpoints={endpoints}
    >
      {isLoading && <DashboardLoadingSkeleton />}

      {isError && (
        <DashboardErrorAlert
          message={error?.message || 'Unable to load request logs.'}
          onRetry={() => {
            void refetch();
          }}
        />
      )}

      {isEmpty && <DashboardEmptyState />}

      {!isLoading && !isError && data && !isEmpty && (
        <section
          aria-label="Recent API request logs"
          className="glass-card chromatic-rim rounded-2xl p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-customText">
              Probe Execution Log Stream ({filteredLogs.length})
            </h2>

            <div className="relative w-full sm:w-80">
              <Search
                aria-hidden="true"
                className="h-4 w-4 text-mutedText absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="search"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                aria-label="Filter request logs"
                placeholder="Filter by method, path, or status code..."
                className="w-full pl-9 pr-9 py-2 rounded-xl border border-subtleBorder bg-surface text-sm text-customText placeholder:text-mutedText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              />
              {logSearch.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLogSearch('')}
                  aria-label="Clear log filter"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-mutedText hover:text-customText hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-subtleBorder p-8 text-center text-xs text-mutedText">
              No request logs match your filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-subtleBorder">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-subtleBorder bg-elevated/60 text-xs uppercase tracking-wider text-mutedText">
                    <th scope="col" className="py-3 px-4 font-semibold">
                      Timestamp
                    </th>
                    <th scope="col" className="py-3 px-4 font-semibold">
                      HTTP
                    </th>
                    <th scope="col" className="py-3 px-4 font-semibold">
                      Service / Path
                    </th>
                    <th scope="col" className="py-3 px-4 font-semibold">
                      Code
                    </th>
                    <th scope="col" className="py-3 px-4 font-semibold">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtleBorder font-mono text-xs tabular-nums">
                  {filteredLogs.map((ep) => {
                    const httpCode = mapStatusToHttpCode(ep.status);
                    const codeColor =
                      httpCode === 200
                        ? 'text-emerald-400'
                        : httpCode === 429
                        ? 'text-amber-400'
                        : 'text-rose-400';

                    return (
                      <tr key={ep.id} className="hover:bg-elevated/40">
                        <td className="py-3 px-4 text-mutedText whitespace-nowrap">
                          {ep.lastChecked.replace('T', ' ').replace('Z', ' UTC')}
                        </td>
                        <td className="py-3 px-4 text-indigo-300 whitespace-nowrap">
                          {ep.method}
                        </td>
                        <td className="py-3 px-4 text-customText whitespace-nowrap">
                          <span className="font-sans font-medium mr-2">
                            {ep.name}
                          </span>
                          <span className="text-mutedText">{ep.path}</span>
                        </td>
                        <td className={`py-3 px-4 font-semibold whitespace-nowrap ${codeColor}`}>
                          {httpCode}
                        </td>
                        <td className="py-3 px-4 text-customText whitespace-nowrap">
                          {ep.responseTimeMs} ms
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}

export default function LogsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Request Logs" subtitle="Loading probe execution logs...">
          <DashboardLoadingSkeleton />
        </AppShell>
      }
    >
      <LogsContent />
    </Suspense>
  );
}
