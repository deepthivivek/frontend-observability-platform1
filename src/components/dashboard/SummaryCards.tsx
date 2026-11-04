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
  reverseColor?: boolean; // if positive is bad (e.g. latency, error rate)
  suffix?: string;
}

const DeltaBadge: React.FC<DeltaBadgeProps> = ({ value, reverseColor = false, suffix = '%' }) => {
  if (value === 0 || isNaN(value)) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-mono text-neutral-400 bg-neutral-800/60 px-1.5 py-0.5 rounded">
        <Minus className="h-3 w-3" />
        0.0{suffix}
      </span>
    );
  }

  const isPositive = value > 0;
  const isGood = reverseColor ? !isPositive : isPositive;

  const colorClasses = isGood
    ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
    : 'text-rose-400 bg-rose-950/60 border border-rose-800/40';

  const Icon = isPositive ? TrendingUp : TrendingDown;
  const sign = isPositive ? '+' : '';

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-mono font-medium px-1.5 py-0.5 rounded ${colorClasses}`}
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
            className="h-36 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 animate-pulse flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <div className="h-4 w-24 bg-neutral-800 rounded" />
              <div className="h-8 w-8 bg-neutral-800 rounded-lg" />
            </div>
            <div className="h-8 w-32 bg-neutral-800 rounded" />
            <div className="h-4 w-40 bg-neutral-800/60 rounded" />
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
      ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
      : metrics.successRate >= 95
      ? 'text-amber-400 bg-amber-950/40 border-amber-800/50'
      : 'text-rose-400 bg-rose-950/40 border-rose-800/50';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Requests Card */}
      <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-sm transition-all hover:border-neutral-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Total Requests
          </span>
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Activity className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl lg:text-3xl font-bold font-mono tracking-tight text-neutral-100">
            {metrics.totalRequests.toLocaleString()}
          </span>
          {deltas && <DeltaBadge value={deltas.totalRequestsDelta} />}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-neutral-400 font-mono">
            {metrics.errorCount} total errors
          </span>
          <Sparkline
            data={requestTrend.length > 1 ? requestTrend : [0, metrics.totalRequests]}
            color="#38bdf8"
            label="Throughput Trend"
            width={100}
            height={28}
          />
        </div>
      </div>

      {/* 2. Success & Error Rates */}
      <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-sm transition-all hover:border-neutral-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Success Rate
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-2xl lg:text-3xl font-bold font-mono tracking-tight text-neutral-100">
            {metrics.successRate.toFixed(2)}%
          </span>
          {deltas && (
            <DeltaBadge value={-deltas.errorRateDelta} suffix="%" />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span
            className={`inline-flex items-center text-xs font-mono font-medium px-2 py-0.5 rounded border ${successBadgeClass}`}
          >
            {metrics.errorCount === 0 ? 'Healthy (0 err)' : `${metrics.errorCount} failures`}
          </span>
          <Sparkline
            data={errorTrend.length > 1 ? errorTrend : [0, metrics.errorCount]}
            color={metrics.errorCount > 0 ? '#f43f5e' : '#10b981'}
            label="Error Trend"
            width={100}
            height={28}
          />
        </div>
      </div>

      {/* 3. Latency Percentiles (Avg / p95 / p99) */}
      <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 backdrop-blur-sm transition-all hover:border-neutral-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Latency (p95 / p99)
          </span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Zap className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl lg:text-3xl font-bold font-mono tracking-tight text-neutral-100">
            {metrics.p95Latency}
            <span className="text-sm font-normal text-neutral-400 ml-1">ms</span>
          </span>
          <span className="text-xs font-mono text-neutral-400">
            (p99: {metrics.p99Latency}ms)
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-neutral-400 font-mono">
            avg: {metrics.avgLatency}ms
          </span>
          <Sparkline
            data={latencyTrend.length > 1 ? latencyTrend : [0, metrics.p95Latency]}
            color="#fbbf24"
            label="Latency Variance"
            width={100}
            height={28}
          />
        </div>
      </div>

      {/* 4. Active Anomalies Breach Counter */}
      <div
        className={`relative overflow-hidden rounded-xl border p-5 backdrop-blur-sm transition-all ${
          metrics.activeAnomaliesCount > 0
            ? 'border-rose-800/80 bg-rose-950/20 shadow-lg shadow-rose-950/20'
            : 'border-neutral-800 bg-neutral-900/60'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Active Anomalies
          </span>
          <div
            className={`p-2 rounded-lg border ${
              metrics.activeAnomaliesCount > 0
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-3">
          <span
            className={`text-2xl lg:text-3xl font-bold font-mono tracking-tight ${
              metrics.activeAnomaliesCount > 0 ? 'text-rose-400' : 'text-neutral-100'
            }`}
          >
            {metrics.activeAnomaliesCount}
          </span>
          <span className="text-xs font-medium text-neutral-400">
            {metrics.activeAnomaliesCount === 0 ? 'No breaches' : 'Rule threshold exceeded'}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            {metrics.activeAnomaliesCount > 0
              ? 'Immediate action recommended'
              : 'All baselines within tolerance'}
          </span>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              metrics.activeAnomaliesCount > 0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
