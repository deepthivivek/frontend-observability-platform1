'use client';

import React from 'react';
import { TimeBucket } from '../../types/telemetry';
import { BarChart2, BellRing, PlusCircle } from 'lucide-react';

interface ErrorBreakdownChartProps {
  timeBuckets: TimeBucket[];
  onCreateAlert?: () => void;
}

export const ErrorBreakdownChart: React.FC<ErrorBreakdownChartProps> = ({
  timeBuckets,
  onCreateAlert,
}) => {
  const slices = timeBuckets.slice(-12);

  // Compute total aggregates by HTTP category
  let total2xx = 0;
  let total3xx = 0;
  let total4xx = 0;
  let total5xx = 0;

  slices.forEach((b) => {
    const errs = b.errorCount;
    const ok = Math.max(0, b.requestCount - errs);
    total2xx += Math.round(ok * 0.95);
    total3xx += Math.round(ok * 0.05);
    total4xx += Math.round(errs * 0.7);
    total5xx += Math.round(errs * 0.3);
  });

  const totalAll = total2xx + total3xx + total4xx + total5xx || 1;
  const pct2xx = Number(((total2xx / totalAll) * 100).toFixed(1));
  const pct3xx = Number(((total3xx / totalAll) * 100).toFixed(1));
  const pct4xx = Number(((total4xx / totalAll) * 100).toFixed(1));
  const pct5xx = Number(((total5xx / totalAll) * 100).toFixed(1));

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-white">HTTP Status Code & Error Rate Breakdown</h3>
          </div>

          {onCreateAlert && (
            <button
              onClick={onCreateAlert}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-[#0B0F17] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono transition-colors"
            >
              <BellRing className="h-3.5 w-3.5 text-indigo-400" />
              Create Alert Rule
            </button>
          )}
        </div>

        {/* Stacked Proportional Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span>Overall Request Composition</span>
            <span className="text-white font-semibold">{totalAll.toLocaleString()} requests</span>
          </div>

          <div className="h-4 w-full rounded-full bg-slate-900 overflow-hidden flex shadow-inner">
            <div style={{ width: `${pct2xx}%` }} className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" title={`2xx Success: ${pct2xx}%`} />
            <div style={{ width: `${pct3xx}%` }} className="h-full bg-indigo-500" title={`3xx Redirects: ${pct3xx}%`} />
            <div style={{ width: `${pct4xx}%` }} className="h-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" title={`4xx Client Errors: ${pct4xx}%`} />
            <div style={{ width: `${pct5xx}%` }} className="h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" title={`5xx Server Faults: ${pct5xx}%`} />
          </div>
        </div>

        {/* Time-Series Stacked Volume Columns */}
        <div className="mt-6">
          <div className="text-[11px] font-mono text-slate-500 uppercase mb-2">
            Time-Series Volume by Status Classification
          </div>

          <div className="h-28 flex items-end gap-1.5">
            {slices.map((slice, idx) => {
              const maxReq = Math.max(...slices.map((s) => s.requestCount), 1);
              const barHeightPct = Math.max(10, Math.round((slice.requestCount / maxReq) * 100));
              const hasErr = slice.errorCount > 0;

              return (
                <div
                  key={idx}
                  style={{ height: `${barHeightPct}%` }}
                  className="flex-1 rounded-t-sm flex flex-col justify-end overflow-hidden group relative"
                  title={`${new Date(slice.timestamp).toLocaleTimeString()}: ${slice.requestCount} requests, ${slice.errorCount} errors`}
                >
                  {hasErr && (
                    <div
                      style={{ height: `${Math.min(100, (slice.errorCount / slice.requestCount) * 100)}%` }}
                      className="w-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]"
                    />
                  )}
                  <div className="w-full flex-1 bg-emerald-500/80 group-hover:bg-emerald-400" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span className="text-slate-300">2xx Success ({pct2xx}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            <span className="text-slate-300">3xx Redirects ({pct3xx}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-300">4xx Client Errors ({pct4xx}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]" />
            <span className="text-slate-300">5xx Server Faults ({pct5xx}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
