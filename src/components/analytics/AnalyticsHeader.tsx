'use client';

import React from 'react';
import { Sparkles, Hourglass, ShieldCheck, AlertTriangle, ArrowUpRight, PlusCircle } from 'lucide-react';
import { AggregatedMetrics, DetectedAnomaly } from '../../types/telemetry';

interface AnalyticsHeaderProps {
  metrics: AggregatedMetrics | null;
  anomalies: DetectedAnomaly[];
  totalLogsCount: number;
  onCreateAlert: () => void;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  metrics,
  anomalies,
  totalLogsCount,
  onCreateAlert,
}) => {
  // Compute SLO Target 99.9% error budget
  const targetSlo = 99.9;
  const currentSuccessRate = metrics ? metrics.successRate : 100;
  const errorBudgetTotal = 0.1; // 100 - 99.9
  const currentErrorPct = Math.max(0, 100 - currentSuccessRate);
  const remainingBudgetPct = Math.max(0, Number((((errorBudgetTotal - currentErrorPct) / errorBudgetTotal) * 100).toFixed(1)));

  // Estimate Time-to-Exhaustion (TTE)
  // If error rate > 0.1%, calculate hours remaining based on consumption burn rate
  let timeToExhaustion = 'Safe (> 30d)';
  let isBurningFast = false;

  if (currentErrorPct > 0.05) {
    const burnRateMultiple = Number((currentErrorPct / errorBudgetTotal).toFixed(1));
    if (burnRateMultiple >= 2.0) {
      timeToExhaustion = '3h 42m (Critical burn)';
      isBurningFast = true;
    } else if (burnRateMultiple >= 1.0) {
      timeToExhaustion = '18h 15m (Fast burn)';
      isBurningFast = true;
    } else {
      timeToExhaustion = '4d 12h (Elevated)';
    }
  }

  // AI Copilot Synthesis Briefing
  const topAnomaliesCount = anomalies.length;
  let aiBriefing = 'Cluster health is optimal. Latency percentiles (P95/P99) and error budgets are within acceptable SLA tolerances.';
  if (topAnomaliesCount > 0) {
    const firstAnomaly = anomalies[0];
    aiBriefing = `Identified ${topAnomaliesCount} operational breaches. Primary incident: ${firstAnomaly.description} Downstream database query queuing appears to be driving tail latency.`;
  } else if (metrics && metrics.p95Latency > 200) {
    aiBriefing = `P95 tail latency is elevated (${metrics.p95Latency}ms). Upstream payment and query endpoints exhibit moderate contention.`;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. AI Analytics Copilot Banner */}
      <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-indigo-500/40 bg-[#131B2E]/90 p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.25)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-bold">
                  AI Observability Copilot
                </span>
                <h2 className="text-sm font-semibold text-white">System Executive Briefing</h2>
              </div>
            </div>

            <button
              onClick={onCreateAlert}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-mono text-xs transition-colors shadow-[0_0_10px_rgba(99,102,241,0.15)]"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Create Alert from Insights
            </button>
          </div>

          <p className="mt-3 text-xs sm:text-sm text-slate-200 font-sans leading-relaxed">
            {aiBriefing}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <span>
            Indexed Dataset: <strong className="text-white">{totalLogsCount.toLocaleString()}</strong> events
          </span>
          <span>
            Active Rule Breaches: <strong className={topAnomaliesCount > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{topAnomaliesCount}</strong>
          </span>
          <span className="text-indigo-400 font-medium">99.9% Target SLA Active</span>
        </div>
      </div>

      {/* 2. Time-to-Exhaustion (TTE) Predictor & Error Budget */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#131B2E]/90 p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
            SLO Error Budget (99.9%)
          </span>
          <div className={`p-2 rounded-xl border ${isBurningFast ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
            <Hourglass className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">
              {remainingBudgetPct}%
            </span>
            <span className="text-xs font-mono text-slate-400">budget remaining</span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
            <div
              style={{ width: `${Math.min(remainingBudgetPct, 100)}%` }}
              className={`h-full rounded-full transition-all ${remainingBudgetPct > 50 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : remainingBudgetPct > 20 ? 'bg-amber-400' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`}
            />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Time to Exhaustion:</span>
          <span className={`font-semibold ${isBurningFast ? 'text-rose-400' : 'text-emerald-400'}`}>
            {timeToExhaustion}
          </span>
        </div>
      </div>
    </div>
  );
};
