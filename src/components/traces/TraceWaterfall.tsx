'use client';

import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Flame,
  Clock,
  Server,
  Layers,
  Copy,
  Check,
  Zap,
  Info,
} from 'lucide-react';
import { TraceTree, TraceSpanNode } from '../../types/trace';

interface TraceWaterfallProps {
  trace: TraceTree;
  onClose?: () => void;
}

export const TraceWaterfall: React.FC<TraceWaterfallProps> = ({ trace, onClose }) => {
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());
  const [selectedSpan, setSelectedSpan] = useState<TraceSpanNode>(trace.rootSpan);
  const [copiedSpanId, setCopiedSpanId] = useState<string | null>(null);

  const toggleCollapse = (spanId: string) => {
    setCollapsedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  };

  const copySpanDetails = (span: TraceSpanNode) => {
    navigator.clipboard.writeText(JSON.stringify(span, null, 2));
    setCopiedSpanId(span.spanId);
    setTimeout(() => setCopiedSpanId(null), 1500);
  };

  const totalDuration = Math.max(trace.totalDurationMs, 1);

  // Flatten spans according to collapse state
  const flattenSpans = (node: TraceSpanNode, list: TraceSpanNode[] = []) => {
    list.push(node);
    if (!collapsedSpans.has(node.spanId) && node.children && node.children.length > 0) {
      for (const child of node.children) {
        flattenSpans(child, list);
      }
    }
    return list;
  };

  const visibleSpans = flattenSpans(trace.rootSpan);

  // Service color palette
  const getServiceColor = (serviceName: string) => {
    const s = serviceName.toLowerCase();
    if (s.includes('gateway')) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    if (s.includes('auth')) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
    if (s.includes('order')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (s.includes('db') || s.includes('postgres')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (s.includes('redis') || s.includes('cache')) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (s.includes('payment') || s.includes('stripe')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  };

  const getBarColor = (span: TraceSpanNode) => {
    if (span.statusCode >= 500) {
      return 'bg-gradient-to-r from-red-600 to-rose-500 border-rose-400';
    }
    if (span.isAnomaly || (span.zScore && span.zScore >= 3.5)) {
      return 'bg-gradient-to-r from-amber-500 to-rose-500 border-amber-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]';
    }
    const s = span.serviceName.toLowerCase();
    if (s.includes('gateway')) return 'bg-gradient-to-r from-cyan-600 to-cyan-400 border-cyan-400';
    if (s.includes('auth')) return 'bg-gradient-to-r from-indigo-600 to-indigo-400 border-indigo-400';
    if (s.includes('order')) return 'bg-gradient-to-r from-emerald-600 to-emerald-400 border-emerald-400';
    if (s.includes('db')) return 'bg-gradient-to-r from-amber-600 to-amber-400 border-amber-400';
    if (s.includes('redis')) return 'bg-gradient-to-r from-rose-600 to-rose-400 border-rose-400';
    return 'bg-gradient-to-r from-blue-600 to-blue-400 border-blue-400';
  };

  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-800 bg-[#0B0F17]/80 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              Distributed Trace
            </span>
            <h3 className="font-mono text-sm font-bold text-white tracking-wide">
              {trace.traceId}
            </h3>
            {trace.hasAnomalies && (
              <span className="flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold animate-pulse">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>Z-SCORE ANOMALY</span>
              </span>
            )}
            {trace.hasErrors && (
              <span className="flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>CASCADE FAILURE</span>
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-slate-400 mt-1 flex items-center space-x-4">
            <span>Root: {trace.rootSpan.serviceName} ({trace.rootSpan.name})</span>
            <span>Duration: <strong className="text-cyan-300">{trace.totalDurationMs}ms</strong></span>
            <span>Spans: {trace.spansCount}</span>
            <span>Services: {trace.services.join(', ')}</span>
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
          >
            Close View
          </button>
        )}
      </div>

      {/* Automated Root Cause Insight Banner */}
      {trace.rootCause && (
        <div className="bg-rose-950/40 border-b border-rose-500/30 p-4 flex items-start space-x-3">
          <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-rose-300 uppercase tracking-wider">Automated Root-Cause Bottleneck:</span>
              <span className="font-mono px-2 py-0.5 rounded bg-rose-900/60 text-white border border-rose-500/40">
                {trace.rootCause.serviceName}
              </span>
            </div>
            <p className="text-slate-200">{trace.rootCause.reason}</p>
            <div className="text-emerald-300 font-mono mt-1 flex items-center space-x-1.5">
              <span className="font-semibold text-emerald-400">Recommended Remediation:</span>
              <span>{trace.rootCause.remediation}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Waterfall Grid & Inspector Pane */}
      <div className="grid grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 flex-1 min-h-[480px]">
        {/* Waterfall Tree View (8 Cols) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col overflow-x-auto">
          {/* Timeline Scale Ruler */}
          <div className="h-8 border-b border-slate-800 bg-[#0B0F17] flex items-center px-4 font-mono text-[10px] text-slate-500 select-none">
            <div className="w-64 shrink-0">Microservice &amp; Span Name</div>
            <div className="flex-1 flex justify-between pr-4">
              <span>0ms</span>
              <span>{(totalDuration * 0.25).toFixed(0)}ms</span>
              <span>{(totalDuration * 0.5).toFixed(0)}ms</span>
              <span>{(totalDuration * 0.75).toFixed(0)}ms</span>
              <span>{totalDuration}ms</span>
            </div>
          </div>

          {/* Span Rows */}
          <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-[560px]">
            {visibleSpans.map((span) => {
              const isSelected = selectedSpan.spanId === span.spanId;
              const hasChildren = span.children && span.children.length > 0;
              const isCollapsed = collapsedSpans.has(span.spanId);

              // Calculate start offset & width percentage on waterfall bar
              const leftPct = Math.min(95, Math.max(0, (span.offsetMs / totalDuration) * 100));
              const widthPct = Math.max(1.5, Math.min(100 - leftPct, (span.durationMs / totalDuration) * 100));

              return (
                <div
                  key={span.spanId}
                  onClick={() => setSelectedSpan(span)}
                  className={`flex items-center px-4 py-2 text-xs font-mono transition cursor-pointer select-none ${
                    isSelected ? 'bg-indigo-600/20 border-l-2 border-indigo-400' : 'hover:bg-slate-800/40'
                  }`}
                >
                  {/* Left: Hierarchy Tree & Name */}
                  <div
                    className="w-64 shrink-0 flex items-center space-x-1.5 overflow-hidden pr-2"
                    style={{ paddingLeft: `${span.depth * 14}px` }}
                  >
                    {hasChildren ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(span.spanId);
                        }}
                        className="text-slate-400 hover:text-white p-0.5"
                      >
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <span className="w-3.5 h-3.5 inline-block" />
                    )}

                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${getServiceColor(span.serviceName)}`}>
                      {span.serviceName}
                    </span>

                    <span className="truncate text-slate-200" title={span.name}>
                      {span.name}
                    </span>
                  </div>

                  {/* Right: Waterfall Duration Bar Canvas */}
                  <div className="flex-1 relative h-6 flex items-center pr-4">
                    <div className="w-full h-1.5 bg-[#0B0F17] rounded-full overflow-hidden absolute inset-y-2" />

                    <div
                      className={`h-4 rounded-md border text-[10px] text-white font-bold flex items-center px-1.5 shadow-md transition-all relative ${getBarColor(span)}`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        minWidth: '24px',
                      }}
                      title={`${span.name}: ${span.durationMs}ms (offset: ${span.offsetMs}ms)`}
                    >
                      {span.isAnomaly && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      )}
                      <span className="truncate">{span.durationMs}ms</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Span Inspector Drawer (4 Cols) */}
        <div className="col-span-12 lg:col-span-4 p-5 space-y-4 bg-[#0B0F17]/50 overflow-y-auto max-h-[600px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h4 className="font-semibold text-xs tracking-wide uppercase text-slate-200">Span Inspector</h4>
            </div>
            <button
              onClick={() => copySpanDetails(selectedSpan)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1 p-1 rounded hover:bg-slate-800"
              title="Copy JSON Payload"
            >
              {copiedSpanId === selectedSpan.spanId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Span Summary Card */}
          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Operation Name</span>
              <span className="font-semibold text-white break-all">{selectedSpan.name}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Service</span>
                <span className="text-cyan-300 font-bold">{selectedSpan.serviceName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Duration</span>
                <span className="text-white font-bold">{selectedSpan.durationMs}ms</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Start Offset</span>
                <span className="text-slate-300">+{selectedSpan.offsetMs}ms</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Status Code</span>
                <span className={selectedSpan.statusCode >= 500 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                  HTTP {selectedSpan.statusCode}
                </span>
              </div>
            </div>

            {/* Anomaly & Z-Score Info */}
            {selectedSpan.zScore !== undefined && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Rolling Z-Score:</span>
                  <span
                    className={`font-bold ${
                      selectedSpan.zScore >= 3.5 ? 'text-rose-400 animate-pulse' : 'text-slate-300'
                    }`}
                  >
                    {selectedSpan.zScore}σ
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {selectedSpan.zScore >= 3.5
                    ? 'Statistical outlier exceeding 3.5σ threshold over sliding baseline.'
                    : 'Within normal latency distribution standard deviations.'}
                </div>
              </div>
            )}

            {/* Span Attributes Table */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] text-slate-500 uppercase block">OpenTelemetry Attributes</span>
              <div className="bg-[#0B0F17] rounded-xl border border-slate-800/80 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                {Object.entries(selectedSpan.attributes || {}).length === 0 ? (
                  <span className="text-slate-500 text-[11px]">No attributes attached to this span.</span>
                ) : (
                  Object.entries(selectedSpan.attributes).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[11px] break-all border-b border-slate-900 pb-1">
                      <span className="text-slate-400 mr-2">{k}:</span>
                      <span className="text-slate-200 text-right">{String(v)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Identifiers */}
            <div className="space-y-1 pt-1 text-[11px]">
              <div className="text-slate-500">
                Span ID: <span className="text-slate-300 select-all">{selectedSpan.spanId}</span>
              </div>
              {selectedSpan.parentSpanId && (
                <div className="text-slate-500">
                  Parent Span ID: <span className="text-slate-300 select-all">{selectedSpan.parentSpanId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
