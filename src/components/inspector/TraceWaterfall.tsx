'use client';

import React, { useState } from 'react';
import { ApiRequestLog } from '../../types/telemetry';
import { TraceSpan } from '../../types/trace';
import { generateSpansForLog } from '../../utils/traceUtils';
import { GitCompare, Flame, BarChart3, Clock, AlertTriangle, Layers } from 'lucide-react';

interface TraceWaterfallProps {
  log: ApiRequestLog;
}

type ViewMode = 'waterfall' | 'flamegraph' | 'diff';

export const TraceWaterfall: React.FC<TraceWaterfallProps> = ({ log }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('waterfall');
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null);

  const spans = generateSpansForLog(log);
  const totalDuration = Math.max(log.latencyMs, 1);

  return (
    <div className="flex flex-col space-y-4">
      {/* Top View Mode Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0B0F17] border border-slate-800/80 font-mono text-xs">
          <button
            onClick={() => setViewMode('waterfall')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'waterfall'
                ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Waterfall
          </button>
          <button
            onClick={() => setViewMode('flamegraph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'flamegraph'
                ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            Flamegraph
          </button>
          <button
            onClick={() => setViewMode('diff')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'diff'
                ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Diff vs Baseline
          </button>
        </div>

        <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-indigo-400" />
          <span>Total: <strong className="text-white">{totalDuration}ms</strong></span>
        </div>
      </div>

      {/* 1. WATERFALL VIEW */}
      {viewMode === 'waterfall' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 uppercase px-1">
            <span>Span Service & Action</span>
            <span>Offset & Duration</span>
          </div>

          <div className="space-y-2">
            {spans.map((span) => {
              const leftPercent = Math.min(((span.startTimeOffsetMs ?? 0) / totalDuration) * 100, 95);
              const widthPercent = Math.max((span.durationMs / totalDuration) * 100, 3);

              const barColor =
                span.status === 'error'
                  ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)] border border-rose-400/40'
                  : span.status === 'warning'
                  ? 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)] border border-amber-300/40'
                  : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] border border-emerald-400/40';

              return (
                <div
                  key={span.id}
                  onClick={() => setSelectedSpan(selectedSpan?.id === span.id ? null : span)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    selectedSpan?.id === span.id
                      ? 'border-indigo-500/60 bg-[#131B2E] shadow-lg'
                      : 'border-slate-800/80 bg-[#0B0F17]/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate max-w-xs">{span.name}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {span.service}
                      </span>
                    </div>
                    <span className="text-slate-300 font-medium">{span.durationMs}ms</span>
                  </div>

                  {/* Waterfall Bar Track */}
                  <div className="w-full h-2.5 rounded-full bg-slate-900/90 overflow-hidden relative">
                    <div
                      style={{
                        marginLeft: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                      className={`h-full rounded-full transition-all ${barColor}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. FLAMEGRAPH VIEW */}
      {viewMode === 'flamegraph' && (
        <div className="space-y-2 p-4 rounded-xl border border-slate-800 bg-[#0B0F17]/90 font-mono">
          <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-amber-400" />
            <span>Interactive Call Hierarchy (Width represents latency weight)</span>
          </div>

          <div className="space-y-1.5">
            {spans.map((span, index) => {
              const widthRatio = Math.max((span.durationMs / totalDuration) * 100, 15);
              return (
                <div
                  key={span.id}
                  onClick={() => setSelectedSpan(span)}
                  style={{ width: `${widthRatio}%`, marginLeft: `${index * 12}px` }}
                  className={`p-2 rounded-lg text-xs truncate cursor-pointer transition-all border ${
                    span.status === 'error'
                      ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                      : span.status === 'warning'
                      ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                      : 'bg-indigo-950/50 border-indigo-500/30 text-indigo-200 hover:border-indigo-400'
                  }`}
                  title={`${span.name} (${span.durationMs}ms)`}
                >
                  <span className="font-bold">{span.name}</span> • {span.durationMs}ms
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. DIFF VS BASELINE */}
      {viewMode === 'diff' && (
        <div className="space-y-3 font-mono">
          <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300">
            Comparing current request execution against <strong>healthy median baseline (P50)</strong>.
          </div>

          <div className="space-y-2">
            {spans.map((span) => {
              const baseline = span.baselineDurationMs || span.durationMs;
              const delta = span.durationMs - baseline;
              const isDegraded = delta > 15;

              return (
                <div
                  key={span.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-[#0B0F17]/80 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">{span.name}</span>
                    <span className="text-[10px] text-slate-500">{span.service}</span>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-slate-400 text-[10px]">Baseline</div>
                      <div className="text-slate-300">{baseline}ms</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Actual</div>
                      <div className={isDegraded ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                        {span.durationMs}ms
                      </div>
                    </div>
                    <div
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                        isDegraded
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {delta > 0 ? `+${delta}ms` : `${delta}ms`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Span Metadata Details Drawer */}
      {selectedSpan && (
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0B0F17] font-mono text-xs space-y-2 animate-in fade-in duration-100">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-white">{selectedSpan.name} Attributes</span>
            <span className="text-slate-400 text-[10px]">{selectedSpan.id}</span>
          </div>
          <div className="space-y-1.5 pt-1">
            {Object.entries(selectedSpan.tags || {}).map(([key, val]) => (
              <div key={key} className="flex items-start justify-between text-slate-400">
                <span className="text-indigo-400">{key}:</span>
                <span className="text-white max-w-xs text-right break-all">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
