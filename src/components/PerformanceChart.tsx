'use client';

import React, { useState, useSyncExternalStore } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import type { PerformancePoint, Timeframe } from '@/src/lib/metrics';

type ChartMetricKey = 'latencyMs' | 'requests' | 'errorRate';

const METRIC_META: Record<
  ChartMetricKey,
  { label: string; unit: string; stroke: string; fillId: string }
> = {
  latencyMs: {
    label: 'Response Latency',
    unit: 'ms',
    stroke: '#818cf8',
    fillId: 'latencyGradient',
  },
  requests: {
    label: 'Request Volume',
    unit: 'req',
    stroke: '#22d3ee',
    fillId: 'requestsGradient',
  },
  errorRate: {
    label: 'Error Rate',
    unit: '%',
    stroke: '#fb7185',
    fillId: 'errorGradient',
  },
};

const TIMEFRAMES: Timeframe[] = ['15m', '1h', '24h', '7d'];

function subscribeEmpty() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(
    subscribeEmpty,
    () => true,
    () => false
  );
}

export function PerformanceChart({
  data,
  timeframe,
  onTimeframeChange,
}: {
  data: readonly PerformancePoint[];
  timeframe: Timeframe;
  onTimeframeChange?: (tf: Timeframe) => void;
}) {
  const [selectedMetric, setSelectedMetric] = useState<ChartMetricKey>('latencyMs');
  const isClient = useIsClient();
  const meta = METRIC_META[selectedMetric];

  return (
    <section
      aria-label="Telemetry performance chart"
      className="glass-card chromatic-rim rounded-2xl p-5 space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-subtleBorder pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <LineChartIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-customText">
              {meta.label} Trend
            </h2>
            <p className="text-xs text-mutedText font-mono">
              {data.length}-point rolling telemetry series ({timeframe})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Chart metric selector"
            className="inline-flex rounded-xl border border-subtleBorder bg-elevated/70 p-1 text-xs"
          >
            {(Object.keys(METRIC_META) as ChartMetricKey[]).map((key) => {
              const active = selectedMetric === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedMetric(key)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    active
                      ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40'
                      : 'text-mutedText hover:text-customText border border-transparent'
                  }`}
                >
                  {METRIC_META[key].label}
                </button>
              );
            })}
          </div>

          {onTimeframeChange && (
            <div
              role="group"
              aria-label="Chart timeframe selector"
              className="inline-flex rounded-xl border border-subtleBorder bg-elevated/70 p-1 text-xs font-mono"
            >
              {TIMEFRAMES.map((tf) => {
                const active = timeframe === tf;
                return (
                  <button
                    key={tf}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onTimeframeChange(tf)}
                    className={`px-2.5 py-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                      active
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                        : 'text-mutedText hover:text-customText border border-transparent'
                    }`}
                  >
                    {tf}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-64 rounded-xl border border-dashed border-subtleBorder flex items-center justify-center text-xs text-mutedText">
          No performance series data available for this timeframe.
        </div>
      ) : (
        <div className="h-72 w-full">
          {isClient ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[...data]}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={meta.fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={meta.stroke} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={meta.stroke} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.14)" />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  unit={` ${meta.unit}`}
                  width={72}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121318',
                    borderColor: 'rgba(255,255,255,0.14)',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={selectedMetric}
                  name={meta.label}
                  stroke={meta.stroke}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#${meta.fillId})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full rounded-xl bg-elevated/40" />
          )}
        </div>
      )}
    </section>
  );
}
