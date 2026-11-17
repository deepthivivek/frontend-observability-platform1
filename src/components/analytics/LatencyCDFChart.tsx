'use client';

import React, { useMemo } from 'react';
import { ApiRequestLog } from '../../types/telemetry';
import { Activity, Server } from 'lucide-react';

interface LatencyCDFChartProps {
  logs: ApiRequestLog[];
}

export const LatencyCDFChart: React.FC<LatencyCDFChartProps> = ({ logs }) => {
  const latencies = useMemo(
    () =>
      logs
        .map((l) => l.latencyMs)
        .filter((l) => typeof l === 'number' && !isNaN(l))
        .sort((a, b) => a - b),
    [logs]
  );

  const hasData = latencies.length > 0;
  const maxLatency = hasData ? Math.max(latencies[latencies.length - 1], 1) : 0;
  const p95Latency = hasData
    ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]
    : 0;

  const sampleSteps = 20;
  const cdfPoints: { latency: number; percentilePct: number }[] = [];
  if (hasData) {
    const total = latencies.length;
    for (let i = 0; i <= sampleSteps; i++) {
      const idx = Math.min(Math.floor((i / sampleSteps) * (total - 1)), total - 1);
      const latency = latencies[idx] || 0;
      const percentilePct = Math.round((i / sampleSteps) * 100);
      cdfPoints.push({ latency, percentilePct });
    }
  }

  const width = 360;
  const height = 180;
  const pad = 30;

  const pathD = hasData
    ? cdfPoints
        .map((pt, i) => {
          const x = pad + (pt.latency / (maxLatency || 1)) * (width - pad * 2);
          const y = height - pad - (pt.percentilePct / 100) * (height - pad * 2);
          return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ')
    : '';

  // Derive real downstream/service breakdown directly from ingested telemetry
  const serviceRows = useMemo(() => {
    if (logs.length === 0) return [];
    const byService = new Map<string, { latencies: number[]; errors: number; count: number }>();
    for (const log of logs) {
      const svcName =
        (log.requestHeaders && (log.requestHeaders['x-service-name'] || log.requestHeaders['host'])) ||
        log.endpoint.split('/').slice(0, 3).join('/') ||
        'otlp-service';
      const entry = byService.get(svcName) || { latencies: [], errors: 0, count: 0 };
      entry.latencies.push(log.latencyMs);
      if (log.statusCode >= 400) entry.errors += 1;
      entry.count += 1;
      byService.set(svcName, entry);
    }

    return Array.from(byService.entries())
      .map(([service, stats]) => {
        stats.latencies.sort((a, b) => a - b);
        const avgLatency = Math.round(
          stats.latencies.reduce((acc, v) => acc + v, 0) / (stats.count || 1)
        );
        const p99Latency =
          stats.latencies[Math.min(stats.latencies.length - 1, Math.floor(stats.latencies.length * 0.99))] ||
          avgLatency;
        const errorRate = Number(((stats.errors / (stats.count || 1)) * 100).toFixed(1));
        const status = errorRate > 4 || p99Latency > 400 ? 'degraded' : errorRate > 1 || p99Latency > 200 ? 'warning' : 'healthy';
        return { service, count: stats.count, avgLatency, p99Latency, errorRate, status };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [logs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Cumulative Distribution Function (CDF) Tail Latency */}
      <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-subtleBorder">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-customText">Cumulative Distribution (CDF)</h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">Tail Latency Curve</span>
          </div>

          <p className="mt-2 text-xs text-mutedText font-mono">
            Reveals inflection points where tail latency departs from baseline latency distribution.
          </p>

          {!hasData ? (
            <div className="mt-4 h-44 flex items-center justify-center rounded-xl border border-subtleBorder bg-canvas/50 text-xs font-mono text-mutedText">
              Awaiting live OpenTelemetry (OTLP) stream...
            </div>
          ) : (
            <div className="mt-4 flex justify-center">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-sm overflow-visible">
                <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="currentColor" className="text-subtleBorder" />
                <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" className="text-subtleBorder" />

                <line x1={pad} y1={height - pad - (height - pad * 2) * 0.5} x2={width - pad} y2={height - pad - (height - pad * 2) * 0.5} stroke="#475569" strokeDasharray="3 3" strokeOpacity="0.4" />
                <line x1={pad} y1={height - pad - (height - pad * 2) * 0.95} x2={width - pad} y2={height - pad - (height - pad * 2) * 0.95} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity="0.5" />

                <text x={pad - 5} y={pad + 10} textAnchor="end" className="text-[10px] fill-mutedText font-mono">100%</text>
                <text x={pad - 5} y={height - pad - (height - pad * 2) * 0.5 + 4} textAnchor="end" className="text-[10px] fill-mutedText font-mono">50%</text>
                <text x={width - pad} y={height - pad + 15} textAnchor="end" className="text-[10px] fill-mutedText font-mono">{maxLatency}ms</text>

                <path d={pathD} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-subtleBorder/60 flex items-center justify-between text-xs font-mono text-mutedText">
          <span>P95 knee marks tail latency boundary</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
            {hasData ? `95% <= ${p95Latency}ms` : '0 samples'}
          </span>
        </div>
      </div>

      {/* 2. Live Service Route Latency Matrix */}
      <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-subtleBorder">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold text-customText">Observed Service Routes</h3>
            </div>
            <span className="text-[11px] font-mono text-mutedText">Live Telemetry Breakdown</span>
          </div>

          {serviceRows.length === 0 ? (
            <div className="mt-4 h-44 flex items-center justify-center rounded-xl border border-subtleBorder bg-canvas/50 text-xs font-mono text-mutedText">
              Awaiting live OpenTelemetry (OTLP) stream...
            </div>
          ) : (
            <div className="mt-3 space-y-2.5 font-mono text-xs">
              {serviceRows.map((dep) => {
                const isDegraded = dep.status === 'degraded';
                const isWarn = dep.status === 'warning';

                return (
                  <div
                    key={dep.service}
                    className="flex items-center justify-between p-3 rounded-xl border border-subtleBorder bg-canvas/80 transition-colors"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-semibold text-customText truncate">{dep.service}</span>
                      <span className="text-[10px] text-mutedText uppercase tabular-nums">
                        {dep.count.toLocaleString()} spans
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-right shrink-0 tabular-nums">
                      <div>
                        <div className="text-[10px] text-mutedText">Avg / P99</div>
                        <div className="text-customText">
                          {dep.avgLatency}ms /{' '}
                          <strong className={isDegraded ? 'text-rose-500 dark:text-rose-400' : 'text-customText'}>
                            {dep.p99Latency}ms
                          </strong>
                        </div>
                      </div>

                      <div
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          isDegraded
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                            : isWarn
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {dep.errorRate}% err
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-subtleBorder/60 flex items-center justify-between text-xs font-mono text-mutedText">
          <span>Derived exclusively from ingested OTLP spans</span>
          <span className="text-indigo-600 dark:text-indigo-400">Real-time aggregation</span>
        </div>
      </div>
    </div>
  );
};
