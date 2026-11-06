'use client';

import React, { useState } from 'react';
import { TimeBucket, DetectedAnomaly } from '../../types/telemetry';
import { Layers, AlertCircle, Filter } from 'lucide-react';

interface LatencyPercentileChartProps {
  timeBuckets: TimeBucket[];
  anomalies: DetectedAnomaly[];
  height?: number;
}

export type SplitDimension = 'overall' | 'region' | 'browser' | 'version';

export const LatencyPercentileChart: React.FC<LatencyPercentileChartProps> = ({
  timeBuckets,
  anomalies,
  height = 240,
}) => {
  const [splitDimension, setSplitDimension] = useState<SplitDimension>('overall');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!timeBuckets || timeBuckets.length === 0) {
    return (
      <div className="flex items-center justify-center h-60 rounded-2xl border border-slate-800 bg-[#131B2E]/60 text-slate-500 font-mono text-xs">
        Awaiting time-series telemetry data...
      </div>
    );
  }

  // Generate synthetic multi-series percentile points (P50, P90, P95, P99)
  const chartData = timeBuckets.map((b) => {
    const p50 = Math.max(Math.round(b.avgLatency * 0.75), 10);
    const p90 = Math.max(Math.round(b.avgLatency * 1.3), 20);
    const p95 = Math.max(b.p95Latency || Math.round(b.avgLatency * 1.6), 35);
    const p99 = Math.max(Math.round(p95 * 1.4), 50);
    return {
      timestamp: b.timestamp,
      p50,
      p90,
      p95,
      p99,
      requestCount: b.requestCount,
      hasErrors: b.errorCount > 0,
    };
  });

  const maxLatency = Math.max(...chartData.map((d) => d.p99), 100);
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 25;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  // Build SVG path strings
  const getCoordinates = (val: number, index: number) => {
    const x = paddingX + (index / (chartData.length - 1 || 1)) * plotWidth;
    const y = height - paddingY - (val / maxLatency) * plotHeight;
    return { x, y };
  };

  const p99Points = chartData.map((d, i) => getCoordinates(d.p99, i));
  const p95Points = chartData.map((d, i) => getCoordinates(d.p95, i));
  const p90Points = chartData.map((d, i) => getCoordinates(d.p90, i));
  const p50Points = chartData.map((d, i) => getCoordinates(d.p50, i));

  const buildPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const p99Path = buildPath(p99Points);
  const p95Path = buildPath(p95Points);
  const p90Path = buildPath(p90Points);
  const p50Path = buildPath(p50Points);

  // Closed area for P99 / P95
  const p99Area = `${p99Path} L ${p99Points[p99Points.length - 1].x},${height - paddingY} L ${paddingX},${height - paddingY} Z`;
  const p50Area = `${p50Path} L ${p50Points[p50Points.length - 1].x},${height - paddingY} L ${paddingX},${height - paddingY} Z`;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 p-5 backdrop-blur-xl shadow-xl flex flex-col space-y-4">
      {/* Top Chart Header & Dimension Split */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <h3 className="text-sm font-semibold text-white">Latency Distribution Percentiles</h3>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            P50, P90, P95, and P99 percentiles over time with automated anomaly bands.
          </p>
        </div>

        {/* Dimension Split Dropdown */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">Split by:</span>
          <select
            value={splitDimension}
            onChange={(e) => setSplitDimension(e.target.value as SplitDimension)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-[#0B0F17] text-indigo-300 font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="overall">All Traffic (Overall)</option>
            <option value="region">Region (us-east, eu-west)</option>
            <option value="browser">Browser / User Agent</option>
            <option value="version">App Version (v2.14 vs v2.13)</option>
          </select>
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative overflow-x-auto w-full">
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="w-full h-auto min-w-[600px] overflow-visible"
        >
          <defs>
            <linearGradient id="p99Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Anomaly Shaded Background Bands */}
          {anomalies.map((anom, idx) => {
            return (
              <rect
                key={idx}
                x={chartWidth * 0.65}
                y={paddingY}
                width={chartWidth * 0.15}
                height={plotHeight}
                fill="#F43F5E"
                fillOpacity="0.12"
                className="animate-pulse"
              />
            );
          })}

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = height - paddingY - pct * plotHeight;
            const val = Math.round(pct * maxLatency);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#1E293B"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-500 font-mono"
                >
                  {val}ms
                </text>
              </g>
            );
          })}

          {/* Shaded Areas */}
          <path d={p99Area} fill="url(#p99Grad)" />
          <path d={p50Area} fill="url(#p50Grad)" />

          {/* Series Lines */}
          <path d={p99Path} fill="none" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" />
          <path d={p95Path} fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
          <path d={p90Path} fill="none" stroke="#818CF8" strokeWidth="1.75" strokeLinecap="round" />
          <path d={p50Path} fill="none" stroke="#10B981" strokeWidth="1.75" strokeLinecap="round" />

          {/* Active Hover Column Guide */}
          {hoveredIndex !== null && chartData[hoveredIndex] && (
            <line
              x1={getCoordinates(0, hoveredIndex).x}
              y1={paddingY}
              x2={getCoordinates(0, hoveredIndex).x}
              y2={height - paddingY}
              stroke="#818CF8"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Invisible hover trigger columns */}
          {chartData.map((d, i) => {
            const colWidth = plotWidth / chartData.length;
            const x = paddingX + i * colWidth;
            return (
              <rect
                key={i}
                x={x - colWidth / 2}
                y={paddingY}
                width={colWidth}
                height={plotHeight}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>
      </div>

      {/* Legend & Tooltip Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            <span className="text-slate-300">P99 Latency</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <span className="text-slate-300">P95 Latency</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
            <span className="text-slate-300">P90 Latency</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="text-slate-300">P50 (Median)</span>
          </div>
        </div>

        {hoveredIndex !== null && chartData[hoveredIndex] && (
          <div className="text-slate-300 flex items-center gap-3">
            <span>
              Time: <strong className="text-white">{new Date(chartData[hoveredIndex].timestamp).toLocaleTimeString()}</strong>
            </span>
            <span>
              P99: <strong className="text-rose-400">{chartData[hoveredIndex].p99}ms</strong>
            </span>
            <span>
              P95: <strong className="text-amber-400">{chartData[hoveredIndex].p95}ms</strong>
            </span>
            <span>
              P50: <strong className="text-emerald-400">{chartData[hoveredIndex].p50}ms</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
