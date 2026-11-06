'use client';

import React, { useState } from 'react';
import {
  Gauge,
  Activity,
  Layers,
  Smartphone,
  Monitor,
  Wifi,
  ExternalLink,
  Zap,
  TrendingDown,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';
import { RumSession } from '../../types/rum';

interface WebVitalsTrackerProps {
  sessions: RumSession[];
  activeSession: RumSession;
  onSelectSession: (id: string) => void;
  onInspectTrace: (traceId: string) => void;
}

export const WebVitalsTracker: React.FC<WebVitalsTrackerProps> = ({
  sessions,
  activeSession,
  onSelectSession,
  onInspectTrace,
}) => {
  const [filterCluster, setFilterCluster] = useState<string>('all');

  // Compute aggregate P75 values across sessions
  const avgLcp = Math.round(
    sessions.reduce((acc, s) => acc + s.webVitals.lcp, 0) / (sessions.length || 1)
  );
  const avgInp = Math.round(
    sessions.reduce((acc, s) => acc + s.webVitals.inp, 0) / (sessions.length || 1)
  );
  const avgCls = Number(
    (
      sessions.reduce((acc, s) => acc + s.webVitals.cls, 0) / (sessions.length || 1)
    ).toFixed(2)
  );
  const avgFcp = Math.round(
    sessions.reduce((acc, s) => acc + s.webVitals.fcp, 0) / (sessions.length || 1)
  );
  const avgTtfb = Math.round(
    sessions.reduce((acc, s) => acc + s.webVitals.ttfb, 0) / (sessions.length || 1)
  );

  const getRating = (metric: string, val: number) => {
    if (metric === 'lcp') {
      if (val <= 2500) return { label: 'Good', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      if (val <= 4000) return { label: 'Needs Improvement', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      return { label: 'Poor', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    }
    if (metric === 'inp') {
      if (val <= 200) return { label: 'Good', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      if (val <= 500) return { label: 'Needs Improvement', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      return { label: 'Poor', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    }
    if (metric === 'cls') {
      if (val <= 0.1) return { label: 'Good', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      if (val <= 0.25) return { label: 'Needs Improvement', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      return { label: 'Poor', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    }
    if (metric === 'fcp') {
      if (val <= 1800) return { label: 'Good', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      if (val <= 3000) return { label: 'Needs Improvement', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      return { label: 'Poor', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    }
    // ttfb
    if (val <= 800) return { label: 'Good', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (val <= 1800) return { label: 'Needs Improvement', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    return { label: 'Poor', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
  };

  const lcpRating = getRating('lcp', activeSession.webVitals.lcp);
  const inpRating = getRating('inp', activeSession.webVitals.inp);
  const clsRating = getRating('cls', activeSession.webVitals.cls);
  const fcpRating = getRating('fcp', activeSession.webVitals.fcp);
  const ttfbRating = getRating('ttfb', activeSession.webVitals.ttfb);

  // Filtered session outliers
  const filteredSessions = sessions.filter((s) => {
    if (filterCluster === 'mobile') return s.device === 'Mobile';
    if (filterCluster === 'desktop') return s.device === 'Desktop';
    if (filterCluster === 'slow_network') return s.networkTier === '4G' || s.networkTier === 'Slow 3G';
    return true;
  });

  return (
    <div className="space-y-5 font-mono text-xs">
      {/* 1. Core Web Vitals Key Scorecards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* LCP */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-bold text-[11px] uppercase">LCP (P75)</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${lcpRating.color}`}>
              {lcpRating.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{activeSession.webVitals.lcp}ms</div>
          <p className="text-[10px] text-slate-400">Largest Contentful Paint (&lt;2.5s good)</p>
        </div>

        {/* INP */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-bold text-[11px] uppercase">INP (P75)</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${inpRating.color}`}>
              {inpRating.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{activeSession.webVitals.inp}ms</div>
          <p className="text-[10px] text-slate-400">Interaction to Next Paint (&lt;200ms good)</p>
        </div>

        {/* CLS */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-bold text-[11px] uppercase">CLS (P75)</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${clsRating.color}`}>
              {clsRating.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{activeSession.webVitals.cls}</div>
          <p className="text-[10px] text-slate-400">Cumulative Layout Shift (&lt;0.1 good)</p>
        </div>

        {/* FCP */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-bold text-[11px] uppercase">FCP (P75)</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${fcpRating.color}`}>
              {fcpRating.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{activeSession.webVitals.fcp}ms</div>
          <p className="text-[10px] text-slate-400">First Contentful Paint (&lt;1.8s good)</p>
        </div>

        {/* TTFB */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-bold text-[11px] uppercase">TTFB (P75)</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${ttfbRating.color}`}>
              {ttfbRating.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">{activeSession.webVitals.ttfb}ms</div>
          <p className="text-[10px] text-slate-400">Time to First Byte (&lt;800ms good)</p>
        </div>
      </div>

      {/* 2. Network-to-RUM Attribution & LoAF Breakdown */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white">
            <Activity className="h-4 w-4 text-indigo-400" />
            <h3 className="font-semibold text-xs">
              Network-to-RUM Attribution &amp; Long Animation Frames (LoAF)
            </h3>
          </div>
          <span className="text-[11px] text-indigo-300">
            Correlated Trace: <strong>{activeSession.correlatedTraceId}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LCP Element Attribution */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0B0F17] space-y-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Slowest LCP DOM Element
            </span>
            <code className="text-xs text-amber-300 block truncate font-mono bg-slate-900 p-2 rounded-lg border border-slate-800">
              {activeSession.webVitals.slowElement || '<button id="btn-place-order">'}
            </code>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
              <span>Downstream API Attribution:</span>
              <strong className="text-rose-400">
                {activeSession.webVitals.networkLatencyAttribution}ms
              </strong>
            </div>
          </div>

          {/* LoAF Main Thread Blocking */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0B0F17] space-y-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Main Thread Long Animation Frame (LoAF)
            </span>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-rose-300">
                {activeSession.webVitals.loafDuration}ms
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                Blocking Thread
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              JavaScript execution exceeded 50ms task threshold, delaying input responsiveness and INP.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Outlier Clustering Matrix */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-white text-xs">
              Real User Outlier Clustering Matrix
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Identifies demographic and hardware sub-populations experiencing performance degradation.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0B0F17] border border-slate-800 text-[11px]">
            <button
              onClick={() => setFilterCluster('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filterCluster === 'all' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({sessions.length})
            </button>
            <button
              onClick={() => setFilterCluster('mobile')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filterCluster === 'mobile' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mobile
            </button>
            <button
              onClick={() => setFilterCluster('desktop')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filterCluster === 'desktop' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Desktop
            </button>
            <button
              onClick={() => setFilterCluster('slow_network')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filterCluster === 'slow_network' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Slow Network
            </button>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0B0F17] text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Session / User</th>
                <th className="py-2.5 px-4">Device &amp; OS</th>
                <th className="py-2.5 px-4">Network</th>
                <th className="py-2.5 px-4">LCP</th>
                <th className="py-2.5 px-4">INP</th>
                <th className="py-2.5 px-4">CLS</th>
                <th className="py-2.5 px-4">Frustration</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredSessions.map((s) => {
                const isSelected = s.id === activeSession.id;
                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isSelected ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{s.userEmail}</div>
                      <div className="text-[10px] text-slate-500">{s.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{s.device}</div>
                      <div className="text-[10px] text-slate-500">{s.os} • {s.browser}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {s.networkTier} ({s.country})
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{s.webVitals.lcp}ms</td>
                    <td className="py-3 px-4">{s.webVitals.inp}ms</td>
                    <td className="py-3 px-4">{s.webVitals.cls}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          s.frustrationScore > 70
                            ? 'bg-rose-500/20 text-rose-300'
                            : s.frustrationScore > 40
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {s.frustrationScore}/100
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => onSelectSession(s.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => onInspectTrace(s.correlatedTraceId)}
                        className="p-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400"
                        title="Jump to trace in Slide-Over Inspector"
                      >
                        <ExternalLink className="h-3.5 w-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
