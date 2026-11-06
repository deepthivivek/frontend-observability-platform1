import React from 'react';
import { TimeBucket } from '../../types/telemetry';

interface HistogramHeaderProps {
  buckets: TimeBucket[];
  height?: number;
  totalLogsCount: number;
}

export const HistogramHeader: React.FC<HistogramHeaderProps> = ({
  buckets,
  height = 40,
  totalLogsCount,
}) => {
  if (!buckets || buckets.length === 0) {
    return (
      <div className="h-10 border-b border-slate-800/80 bg-[#0B0F17]/60 flex items-center justify-between px-4 text-xs font-mono text-slate-500">
        <span>Density Distribution</span>
        <span>Awaiting telemetry samples...</span>
      </div>
    );
  }

  const maxCount = Math.max(...buckets.map((b) => b.requestCount), 1);
  const totalErrors = buckets.reduce((acc, b) => acc + b.errorCount, 0);

  return (
    <div className="border-b border-slate-800/80 bg-[#0B0F17]/90 px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Density Histogram
        </span>
        <span className="text-xs font-mono text-slate-500">
          ({buckets.length} windows • {totalLogsCount.toLocaleString()} total •{' '}
          <span className={totalErrors > 0 ? 'text-rose-400 font-medium' : 'text-emerald-400 font-medium'}>
            {totalErrors} errors
          </span>)
        </span>
      </div>

      <div className="flex items-end gap-1 h-7 flex-1 max-w-md sm:justify-end">
        {buckets.map((bucket, index) => {
          const ratio = bucket.requestCount / maxCount;
          const barHeightPx = Math.max(Math.round(ratio * 24), 3);
          const hasErrors = bucket.errorCount > 0;
          const isHighLatency = bucket.p95Latency > 250;

          return (
            <div
              key={bucket.timestamp || index}
              className="group relative flex-1 min-w-[3px] max-w-[12px] bg-slate-800/80 rounded-t-sm hover:bg-slate-700 transition-colors cursor-pointer flex flex-col justify-end"
              title={`${new Date(bucket.timestamp).toLocaleTimeString()} - ${bucket.requestCount} requests, ${bucket.errorCount} errors, p95: ${bucket.p95Latency}ms`}
            >
              <div
                style={{ height: `${barHeightPx}px` }}
                className={`w-full rounded-t-sm transition-all ${
                  hasErrors
                    ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
                    : isHighLatency
                    ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]'
                    : 'bg-indigo-500 group-hover:bg-indigo-400'
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
