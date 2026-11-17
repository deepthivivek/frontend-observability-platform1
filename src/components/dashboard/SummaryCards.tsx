import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { AggregatedMetrics, MetricDeltas, TimeBucket } from '../../types/telemetry';
import { Sparkline } from './Sparkline';

interface SummaryCardsProps {
  metrics: AggregatedMetrics | null;
  deltas?: MetricDeltas | null;
  timeBuckets?: TimeBucket[];
  isLoading?: boolean;
}

interface DeltaBadgeProps {
  value: number;
  reverseColor?: boolean;
  suffix?: string;
}

const DeltaBadge: React.FC<DeltaBadgeProps> = ({ value, reverseColor = false, suffix = '%' }) => {
  if (value === 0 || isNaN(value)) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-mono tabular-nums text-mutedText bg-elevated px-2 py-0.5 rounded-full border border-subtleBorder">
        <Minus className="h-3 w-3" />
        0.0{suffix}
      </span>
    );
  }

  const isPositive = value > 0;
  const isGood = reverseColor ? !isPositive : isPositive;

  const colorClasses = isGood
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
    : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/30';

  const Icon = isPositive ? TrendingUp : TrendingDown;
  const sign = isPositive ? '+' : '';

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums font-medium px-2 py-0.5 rounded-full ${colorClasses}`}
      title={`${sign}${value}${suffix} compared to prior period`}
    >
      <Icon className="h-3 w-3" />
      {sign}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
};

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  metrics,
  deltas,
  timeBuckets = [],
  isLoading = false,
}) => {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-40 rounded-2xl border border-subtleBorder bg-surface/80 p-5 animate-pulse flex flex-col justify-between backdrop-blur-xl"
          >
            <div className="flex justify-between items-start">
              <div className="h-4 w-28 bg-elevated rounded-md" />
              <div className="h-9 w-9 bg-elevated rounded-xl" />
            </div>
            <div className="h-9 w-36 bg-elevated rounded-md" />
            <div className="h-4 w-44 bg-elevated/70 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  // Extract sparkline trends from timeBuckets
  const requestTrend = timeBuckets.map((b) => b.requestCount);
  const latencyTrend = timeBuckets.map((b) => b.p95Latency || b.avgLatency);
  const errorTrend = timeBuckets.map((b) => b.errorCount);

  // Status color evaluation for success rate
  const successBadgeClass =
    metrics.successRate >= 99
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : metrics.successRate >= 95
      ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Requests Card - Electric Indigo Accent */}
      <div className="glass-card chromatic-rim group relative overflow-hidden rounded-2xl p-5">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/15 transition-all pointer-events-none" />

        <div className="relative flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-mutedText">
            Total Requests
          </span>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
            <Activity className="h-4 w-4" />
          </div>
        </div>

        <div className="relative mt-3 flex items-baseline gap-3">
          <span className="text-2xl lg:text-3xl font-bold font-mono tabular-nums tracking-tight text-customText">
            {metrics.totalRequests.toLocaleString()}
          </span>
          {deltas && <DeltaBadge value={deltas.totalRequestsDelta} />}
        </div>

        <div className="relative mt-4 flex items-center justify-between pt-2 border-t border-subtleBorder">
          <span className="text-xs text-mutedText font-mono tabular-nums">
            {metrics.errorCount} total errors
          </span>
          <Sparkline
            data={requestTrend.length > 1 ? requestTrend : [0, metrics.totalRequests]}
            color="#818CF8"
            label="Throughput Trend"
            width={110}
            height={30}
            gradientId="sparkline-indigo-requests"
          />
        </div>
      </div>

      {/* 2. Success & Error Rates - Neon Teal/Emerald Accent */}
      <div className="glass-card chromatic-rim group relative overflow-hidden rounded-2xl p-5">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/15 transition-all pointer-events-none" />

        <div className="relative flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-mutedText">
            Success Rate
          </span>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>

        <div className="relative mt-3 flex items-baseline gap-3">
          <span className="text-2xl lg:text-3xl font-bold font-mono tabular-nums tracking-tight text-customText">
            {metrics.successRate.toFixed(2)}%
          </span>
          {deltas && (
            <DeltaBadge value={-deltas.errorRateDelta} suffix="%" />
          )}
        </div>

        <div className="relative mt-4 flex items-center justify-between pt-2 border-t border-subtleBorder">
          <span
            className={`inline-flex items-center text-xs font-mono tabular-nums font-medium px-2 py-0.5 rounded-full border ${successBadgeClass}`}
          >
            {metrics.errorCount === 0 ? 'Healthy (0 err)' : `${metrics.errorCount} failures`}
          </span>
          <Sparkline
            data={errorTrend.length > 1 ? errorTrend : [0, metrics.errorCount]}
            color={metrics.errorCount > 0 ? '#F43F5E' : '#10B981'}
            label="Error Trend"
            width={110}
            height={30}
            gradientId="sparkline-emerald-errors"
          />
        </div>
      </div>

      {/* 3. Latency Percentiles (p95 / p99) - Vibrant Amber Accent */}
      <div className="glass-card chromatic-rim group relative overflow-hidden rounded-2xl p-5">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl group-hover:bg-amber-500/15 transition-all pointer-events-none" />

        <div className="relative flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-mutedText">
            Latency (p95 / p99)
          </span>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Zap className="h-4 w-4" />
          </div>
        </div>

        <div className="relative mt-3 flex items-baseline gap-2">
          <span className="text-2xl lg:text-3xl font-bold font-mono tabular-nums tracking-tight text-customText">
            {metrics.p95Latency}
            <span className="text-sm font-normal text-mutedText ml-1">ms</span>
          </span>
          <span className="text-xs font-mono tabular-nums text-mutedText">
            (p99: {metrics.p99Latency}ms)
          </span>
        </div>

        <div className="relative mt-4 flex items-center justify-between pt-2 border-t border-subtleBorder">
          <span className="text-xs text-mutedText font-mono tabular-nums">
            avg: {metrics.avgLatency}ms
          </span>
          <Sparkline
            data={latencyTrend.length > 1 ? latencyTrend : [0, metrics.p95Latency]}
            color="#F59E0B"
            label="Latency Variance"
            width={110}
            height={30}
            gradientId="sparkline-amber-latency"
          />
        </div>
      </div>

      {/* 4. Active Anomalies Breach Counter - Glowing Crimson Accent */}
      <div
        className={`glass-card chromatic-rim group relative overflow-hidden rounded-2xl p-5 ${
          metrics.activeAnomaliesCount > 0 ? 'border-rose-500/50' : ''
        }`}
      >
        <div
          className={`absolute top-0 right-0 -mr-8 -mt-8 h-28 w-28 rounded-full blur-2xl transition-all pointer-events-none ${
            metrics.activeAnomaliesCount > 0 ? 'bg-rose-500/20' : 'bg-indigo-500/10'
          }`}
        />

        <div className="relative flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-mutedText">
            Active Anomalies
          </span>
          <div
            className={`p-2.5 rounded-xl border ${
              metrics.activeAnomaliesCount > 0
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40'
                : 'bg-elevated text-mutedText border-subtleBorder'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>

        <div className="relative mt-3 flex items-baseline gap-3">
          <span
            className={`text-2xl lg:text-3xl font-bold font-mono tabular-nums tracking-tight ${
              metrics.activeAnomaliesCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-customText'
            }`}
          >
            {metrics.activeAnomaliesCount}
          </span>
          <span className="text-xs font-medium text-mutedText">
            {metrics.activeAnomaliesCount === 0 ? 'No breaches' : 'Rule threshold exceeded'}
          </span>
        </div>

        <div className="relative mt-4 flex items-center justify-between pt-2 border-t border-subtleBorder">
          <span className="text-xs text-mutedText">
            {metrics.activeAnomaliesCount > 0
              ? 'Immediate action recommended'
              : 'All baselines within tolerance'}
          </span>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              metrics.activeAnomaliesCount > 0
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
