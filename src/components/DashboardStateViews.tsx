'use client';

import React from 'react';
import { AlertCircle, Database, RefreshCw } from 'lucide-react';

export function DashboardLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading telemetry metrics"
      className="space-y-6 animate-pulse"
    >
      <span className="sr-only">Loading telemetry metrics...</span>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="glass-card rounded-2xl p-5 space-y-3"
          >
            <div className="h-3.5 w-28 rounded bg-elevated" />
            <div className="h-8 w-32 rounded bg-elevated" />
            <div className="h-3 w-20 rounded bg-elevated" />
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 rounded bg-elevated" />
          <div className="h-8 w-52 rounded-xl bg-elevated" />
        </div>
        <div className="h-64 w-full rounded-xl bg-elevated/70" />
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="h-9 w-full rounded-xl bg-elevated" />
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-11 w-full rounded-xl bg-elevated/70" />
        ))}
      </div>
    </div>
  );
}

export function DashboardErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="glass-card rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-rose-300">
            Failed to load metrics
          </h2>
          <p className="text-xs font-mono text-rose-200/80">{message}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Retry</span>
      </button>
    </div>
  );
}

export function DashboardEmptyState({
  title = 'No telemetry data available',
  description = 'The metrics API returned an empty telemetry snapshot. Check upstream collectors or query parameters.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-3">
      <div className="h-12 w-12 rounded-2xl border border-subtleBorder bg-elevated flex items-center justify-center text-mutedText">
        <Database className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-customText">{title}</h2>
      <p className="text-xs text-mutedText max-w-md">{description}</p>
    </div>
  );
}
