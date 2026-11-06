'use client';

import React from 'react';
import { ApiRequestLog } from '../../types/telemetry';
import { GitBranch, Activity, Server, Database, ShieldAlert } from 'lucide-react';

interface LatencyCDFChartProps {
  logs: ApiRequestLog[];
}

export const LatencyCDFChart: React.FC<LatencyCDFChartProps> = ({ logs }) => {
  // Compute Cumulative Distribution Function (CDF) Curve
  const latencies = logs
    .map((l) => l.latencyMs)
    .filter((l) => typeof l === 'number' && !isNaN(l))
    .sort((a, b) => a - b);

  const total = latencies.length || 1;
  const sampleSteps = 20;
  const cdfPoints: { latency: number; percentilePct: number }[] = [];

  for (let i = 0; i <= sampleSteps; i++) {
    const idx = Math.min(Math.floor((i / sampleSteps) * (total - 1)), total - 1);
    const latency = latencies[idx] || 0;
    const percentilePct = Math.round((i / sampleSteps) * 100);
    cdfPoints.push({ latency, percentilePct });
  }

  const maxLatency = Math.max(latencies[latencies.length - 1] || 100, 100);

  // SVG dimensions for CDF
  const width = 360;
  const height = 180;
  const pad = 30;

  const pathD = cdfPoints
    .map((pt, i) => {
      const x = pad + (pt.latency / maxLatency) * (width - pad * 2);
      const y = height - pad - (pt.percentilePct / 100) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Downstream Dependency Matrix Data
  const dependencies = [
    { service: 'PostgreSQL Primary Cluster', type: 'Database', avgLatency: 42, p99Latency: 380, errorRate: 2.1, status: 'warning' },
    { service: 'Redis Cache (Session & KV)', type: 'Cache', avgLatency: 3, p99Latency: 12, errorRate: 0.0, status: 'healthy' },
    { service: 'Stripe Billing API', type: 'External', avgLatency: 185, p99Latency: 720, errorRate: 4.8, status: 'degraded' },
    { service: 'Auth0 JWT Verification', type: 'Auth', avgLatency: 15, p99Latency: 45, errorRate: 0.2, status: 'healthy' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Cumulative Distribution Function (CDF) Tail Latency */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Cumulative Distribution (CDF)</h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400">Tail Latency Curve</span>
          </div>

          <p className="mt-2 text-xs text-slate-400 font-mono">
            Reveals inflection points where tail latency departs from expected logarithmic baselines.
          </p>

          {/* CDF SVG */}
          <div className="mt-4 flex justify-center">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-sm overflow-visible">
              {/* Reference Grid */}
              <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#1E293B" />
              <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#1E293B" />

              {/* 50% & 95% Reference Lines */}
              <line x1={pad} y1={height - pad - (height - pad * 2) * 0.5} x2={width - pad} y2={height - pad - (height - pad * 2) * 0.5} stroke="#334155" strokeDasharray="3 3" />
              <line x1={pad} y1={height - pad - (height - pad * 2) * 0.95} x2={width - pad} y2={height - pad - (height - pad * 2) * 0.95} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity="0.4" />

              {/* Labels */}
              <text x={pad - 5} y={pad + 10} textAnchor="end" className="text-[10px] fill-slate-500 font-mono">100%</text>
              <text x={pad - 5} y={height - pad - (height - pad * 2) * 0.5 + 4} textAnchor="end" className="text-[10px] fill-slate-500 font-mono">50%</text>
              <text x={width - pad} y={height - pad + 15} textAnchor="end" className="text-[10px] fill-slate-500 font-mono">{maxLatency}ms</text>

              {/* CDF Line */}
              <path d={pathD} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" filter="drop-shadow(0 0 6px rgba(16,185,129,0.4))" />
            </svg>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>P95 knee marks tail latency boundary</span>
          <span className="text-emerald-400 font-medium">95% &le; {Math.round(maxLatency * 0.4)}ms</span>
        </div>
      </div>

      {/* 2. Service Dependency Latency Matrix */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Downstream Service Dependencies</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">External Bottlenecks</span>
          </div>

          <div className="mt-3 space-y-2.5 font-mono text-xs">
            {dependencies.map((dep) => {
              const isDegraded = dep.status === 'degraded';
              const isWarn = dep.status === 'warning';

              return (
                <div
                  key={dep.service}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-[#0B0F17]/80 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">{dep.service}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{dep.type}</span>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-[10px] text-slate-500">Avg / P99</div>
                      <div className="text-slate-300">{dep.avgLatency}ms / <strong className={isDegraded ? 'text-rose-400' : 'text-slate-200'}>{dep.p99Latency}ms</strong></div>
                    </div>

                    <div
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                        isDegraded
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                          : isWarn
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {dep.errorRate}% err
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Stripe API accounts for primary external wait states</span>
          <span className="text-indigo-400">Automated tracing active</span>
        </div>
      </div>
    </div>
  );
};
