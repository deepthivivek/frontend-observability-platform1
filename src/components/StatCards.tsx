'use client';

import React from 'react';
import {
  getDeltaPresentation,
  type EndpointRow,
  type StatMetric,
} from '@/src/lib/metrics';
import { calculateDashboardSummary } from '@/src/lib/filterEndpoints';

export function StatCards({
  stats,
  endpoints,
}: {
  stats: readonly StatMetric[];
  endpoints: readonly EndpointRow[];
}) {
  const summary = calculateDashboardSummary(endpoints);

  return (
    <section aria-label="Telemetry key metrics" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const delta = getDeltaPresentation(
            stat.changePercent,
            stat.higherIsBetter
          );

          return (
            <article
              key={stat.id}
              className="glass-card chromatic-rim rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-medium uppercase tracking-wider text-mutedText">
                  {stat.label}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-mono font-semibold tabular-nums ${delta.colorClass}`}
                >
                  <span aria-hidden="true">{delta.arrow}</span>
                  <span>{delta.formattedValue}</span>
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums text-customText">
                  {stat.value.toLocaleString()}
                </span>
                {stat.unit && (
                  <span className="text-xs font-mono text-mutedText">
                    {stat.unit}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-mutedText">
                {stat.higherIsBetter
                  ? 'Higher values indicate stronger performance'
                  : 'Lower values indicate healthier latency/errors'}
              </p>
            </article>
          );
        })}
      </div>

      {endpoints.length > 0 && (
        <div
          aria-label="Fleet health summary"
          className="glass-card rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-mutedText">Monitored Endpoints:</span>
            <span className="font-mono font-semibold tabular-nums text-customText">
              {summary.totalEndpoints}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-mutedText">Healthy Rate:</span>
            <span className="font-mono font-semibold tabular-nums text-emerald-400">
              {summary.healthyRatePercent.toFixed(1)}% ({summary.healthyCount}/{summary.totalEndpoints})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-mutedText">Fleet Avg Response:</span>
            <span className="font-mono font-semibold tabular-nums text-cyan-400">
              {summary.averageResponseTimeMs} ms
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span className="text-amber-400">
              {summary.warningCount} Warning
            </span>
            <span className="text-rose-400">
              {summary.failedCount} Failed
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
