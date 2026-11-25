'use client';

import React, { useState } from 'react';
import {
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import type { EndpointRow, EndpointStatus } from '@/src/lib/metrics';
import {
  calculateDashboardSummary,
  filterAndSortEndpoints,
  type EndpointStatusFilter,
  type SortDirection,
} from '@/src/lib/filterEndpoints';

const STATUS_OPTIONS: EndpointStatusFilter[] = [
  'All',
  'Healthy',
  'Warning',
  'Failed',
];

function getNextSortDirection(current: SortDirection): SortDirection {
  if (current === 'none') return 'asc';
  if (current === 'asc') return 'desc';
  return 'none';
}

function getAriaSortValue(sort: SortDirection): 'ascending' | 'descending' | 'none' {
  if (sort === 'asc') return 'ascending';
  if (sort === 'desc') return 'descending';
  return 'none';
}

function StatusBadge({ status }: { status: EndpointStatus }) {
  if (status === 'Healthy') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Healthy</span>
      </span>
    );
  }
  if (status === 'Warning') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-medium">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Warning</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-medium">
      <XCircle className="h-3.5 w-3.5" />
      <span>Failed</span>
    </span>
  );
}

export interface EndpointTableProps {
  endpoints: readonly EndpointRow[];
  query?: string;
  status?: EndpointStatusFilter;
  sort?: SortDirection;
  onQueryChange?: (nextQuery: string) => void;
  onStatusChange?: (nextStatus: EndpointStatusFilter) => void;
  onSortChange?: (nextSort: SortDirection) => void;
  onResetFilters?: () => void;
}

export function EndpointTable({
  endpoints,
  query: controlledQuery,
  status: controlledStatus,
  sort: controlledSort,
  onQueryChange,
  onStatusChange,
  onSortChange,
  onResetFilters,
}: EndpointTableProps) {
  const [internalQuery, setInternalQuery] = useState('');
  const [internalStatus, setInternalStatus] = useState<EndpointStatusFilter>('All');
  const [internalSort, setInternalSort] = useState<SortDirection>('none');

  const query = controlledQuery !== undefined ? controlledQuery : internalQuery;
  const status = controlledStatus !== undefined ? controlledStatus : internalStatus;
  const sort = controlledSort !== undefined ? controlledSort : internalSort;

  const setQuery = (next: string) => {
    if (onQueryChange) {
      onQueryChange(next);
    } else {
      setInternalQuery(next);
    }
  };

  const setStatus = (next: EndpointStatusFilter) => {
    if (onStatusChange) {
      onStatusChange(next);
    } else {
      setInternalStatus(next);
    }
  };

  const setSort = (next: SortDirection) => {
    if (onSortChange) {
      onSortChange(next);
    } else {
      setInternalSort(next);
    }
  };

  const handleReset = () => {
    if (onResetFilters) {
      onResetFilters();
    } else {
      setInternalQuery('');
      setInternalStatus('All');
      setInternalSort('none');
    }
  };

  const summary = calculateDashboardSummary(endpoints);
  const filteredEndpoints = filterAndSortEndpoints(endpoints, {
    query,
    status,
    sort,
  });

  const statusCounts: Record<EndpointStatusFilter, number> = {
    All: summary.totalEndpoints,
    Healthy: summary.healthyCount,
    Warning: summary.warningCount,
    Failed: summary.failedCount,
  };

  return (
    <section
      aria-label="Monitored API endpoints"
      className="glass-card chromatic-rim rounded-2xl p-5 space-y-4"
    >
      {/* Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search
            aria-hidden="true"
            className="h-4 w-4 text-mutedText absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search endpoints"
            placeholder="Search by endpoint name, path, or method..."
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-subtleBorder bg-surface text-sm text-customText placeholder:text-mutedText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-mutedText hover:text-customText hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div
          role="group"
          aria-label="Filter endpoints by status"
          className="flex flex-wrap items-center gap-2"
        >
          {STATUS_OPTIONS.map((option) => {
            const isPressed = status === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={isPressed}
                onClick={() => setStatus(option)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  isPressed
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-surface text-mutedText hover:text-customText hover:bg-elevated border-subtleBorder'
                }`}
              >
                <span>{option}</span>{' '}
                <span className="font-mono text-[11px] tabular-nums opacity-85">
                  ({statusCounts[option]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Table or Empty Filter Message */}
      {filteredEndpoints.length === 0 ? (
        <div className="rounded-xl border border-dashed border-subtleBorder p-8 text-center space-y-3">
          <p className="text-sm font-medium text-customText">
            No endpoints match your filters
          </p>
          <p className="text-xs text-mutedText">
            Try clearing your search query or selecting a different endpoint status.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-500/40 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset filters</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-subtleBorder">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-subtleBorder bg-elevated/60 text-xs uppercase tracking-wider text-mutedText">
                <th scope="col" className="py-3 px-4 font-semibold">
                  Endpoint
                </th>
                <th scope="col" className="py-3 px-4 font-semibold">
                  Method &amp; Path
                </th>
                <th scope="col" className="py-3 px-4 font-semibold">
                  Status
                </th>
                <th
                  scope="col"
                  aria-sort={getAriaSortValue(sort)}
                  className="py-3 px-4 font-semibold"
                >
                  <button
                    type="button"
                    onClick={() => setSort(getNextSortDirection(sort))}
                    className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-mutedText hover:text-customText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded px-1 py-0.5 -ml-1"
                  >
                    <span>Response Time</span>
                    {sort === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5 text-indigo-400" />
                    ) : sort === 'desc' ? (
                      <ArrowDown className="h-3.5 w-3.5 text-indigo-400" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
                    )}
                  </button>
                </th>
                <th scope="col" className="py-3 px-4 font-semibold">
                  Uptime
                </th>
                <th scope="col" className="py-3 px-4 font-semibold">
                  Last Checked
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtleBorder">
              {filteredEndpoints.map((ep) => (
                <tr
                  key={ep.id}
                  className="hover:bg-elevated/40 transition-colors"
                >
                  <td className="py-3.5 px-4 font-medium text-customText whitespace-nowrap">
                    {ep.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 rounded bg-elevated border border-subtleBorder text-indigo-300 mr-2">
                      {ep.method}
                    </span>
                    <span className="text-mutedText">{ep.path}</span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge status={ep.status} />
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-customText whitespace-nowrap">
                    {ep.responseTimeMs} ms
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-mutedText whitespace-nowrap">
                    {ep.uptimePercent.toFixed(2)}%
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-mutedText whitespace-nowrap">
                    {ep.lastChecked.replace('T', ' ').replace('Z', ' UTC')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
