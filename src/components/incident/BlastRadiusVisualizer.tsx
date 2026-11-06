'use client';

import React from 'react';
import {
  Activity,
  AlertTriangle,
  Flame,
  Users,
  DollarSign,
  TrendingUp,
  Server,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Incident } from '../../types/incident';

interface BlastRadiusVisualizerProps {
  incident: Incident;
}

export const BlastRadiusVisualizer: React.FC<BlastRadiusVisualizerProps> = ({ incident }) => {
  const { blastRadius } = incident;

  return (
    <div className="space-y-6">
      {/* 1. Top High-Level Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Affected User Sessions */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Affected User Sessions</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {blastRadius.affectedUserSessions.toLocaleString()}
            </div>
            <span className="text-[11px] text-cyan-300 font-medium">Real User Monitoring Impact</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: User Frustration Score */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">UX Frustration Index</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-400">
              {blastRadius.frustrationScore} <span className="text-xs text-slate-400">/ 100</span>
            </div>
            <span className="text-[11px] text-amber-300/80 font-medium">Rage Clicks & Dead Clicks</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 3: SLO Burn Rate */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">SLO Error Budget Burn</span>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-rose-400">
              {blastRadius.sloBurnRate}x
            </div>
            <span className="text-[11px] text-rose-300 font-medium">99.9% SLO Exhaustion Risk</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 4: Estimated Revenue Exposure */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Est. Revenue at Risk</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-emerald-400">
              ${blastRadius.revenueImpactEstimated.toLocaleString()}
            </div>
            <span className="text-[11px] text-emerald-300/80 font-medium">Cart Abandonment Exposure</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>
      </div>

      {/* 2. Cascading Microservice Dependency Blast Radius Tree */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <Server className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Cascading Microservice Blast Radius
            </h4>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Direct ({blastRadius.directServices.length}) &bull; Downstream ({blastRadius.downstreamServices.length})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Direct Root Impact */}
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/20 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-rose-300">
              <span className="font-bold uppercase tracking-wide">Root Failure Zone</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[10px]">
                CRITICAL
              </span>
            </div>
            <div className="space-y-1.5">
              {blastRadius.directServices.map((svc) => (
                <div
                  key={svc}
                  className="bg-[#0B0F17] border border-rose-500/30 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono"
                >
                  <span className="text-white font-semibold">{svc}</span>
                  <span className="text-rose-400 font-bold">{incident.errorRatePeak}% err</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cascade Connector Arrow */}
          <div className="flex flex-col items-center justify-center space-y-1 text-slate-500">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Cascading Latency Contagion
            </div>
            <ArrowRight className="w-6 h-6 text-amber-400 animate-pulse hidden md:block" />
          </div>

          {/* Downstream Impact Zone */}
          <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-amber-300">
              <span className="font-bold uppercase tracking-wide">Downstream Impact Zone</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px]">
                DEGRADED
              </span>
            </div>
            <div className="space-y-1.5">
              {blastRadius.downstreamServices.map((svc) => (
                <div
                  key={svc}
                  className="bg-[#0B0F17] border border-amber-500/30 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono"
                >
                  <span className="text-white">{svc}</span>
                  <span className="text-amber-400 font-semibold">P99: {Math.round(incident.p99LatencyMs * 0.75)}ms</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Real-Time Telemetry Correlation Chart Mock */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Error Rate Surge vs SLO Threshold</span>
          </span>
          <span className="text-slate-400 text-[11px]">Time Window: Last 60 Minutes</span>
        </div>

        <div className="h-32 bg-[#0B0F17] rounded-xl border border-slate-800 p-4 flex items-end space-x-2 relative overflow-hidden">
          {/* Simulated Bars */}
          {[1.2, 1.4, 1.1, 1.8, 3.2, 5.8, 12.4, 19.4, 18.2, 16.5, 14.2, 12.0, 9.5].map((val, idx) => {
            const heightPercent = Math.min(100, (val / 20) * 100);
            const isHigh = val >= 10;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t transition-all ${
                    isHigh
                      ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                      : 'bg-indigo-600/60'
                  }`}
                />
                <div className="opacity-0 group-hover:opacity-100 transition absolute -top-7 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-white whitespace-nowrap pointer-events-none">
                  {val}%
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>T -60m (Baseline 1.2%)</span>
          <span className="text-rose-400 font-bold">Peak: {incident.errorRatePeak}% (Breach)</span>
          <span>Now</span>
        </div>
      </div>
    </div>
  );
};
