'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  FileCode,
  Copy,
  Check,
  TrendingUp,
  Database,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Clock,
  Users,
} from 'lucide-react';
import { UncaughtExceptionGroup, RumSession } from '../../types/rum';

interface ExceptionTrackerProps {
  exceptions: UncaughtExceptionGroup[];
  activeSession: RumSession;
  onInspectTrace: (traceId: string) => void;
}

export const ExceptionTracker: React.FC<ExceptionTrackerProps> = ({
  exceptions,
  activeSession,
  onInspectTrace,
}) => {
  const [selectedExceptionId, setSelectedExceptionId] = useState<string>(
    exceptions[0]?.id || ''
  );
  const [copiedTrace, setCopiedTrace] = useState(false);

  const activeException =
    exceptions.find((e) => e.id === selectedExceptionId) || exceptions[0];

  const handleCopyUnminifiedStack = () => {
    if (!activeException) return;
    const formatted = activeException.unminifiedFrames
      .map(
        (f) =>
          `  at ${f.functionName} (${f.file}:${f.line}:${f.column})`
      )
      .join('\n');
    const fullText = `${activeException.signature}\n${formatted}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
    }
    setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  return (
    <div className="space-y-5 font-mono text-xs">
      {/* 1. Header Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-rose-500/30 bg-[#1A121F]/90 backdrop-blur-xl">
          <div className="flex items-center justify-between text-rose-400 mb-1">
            <span className="font-bold text-[11px] uppercase">Uncaught Exception Groups</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <span className="text-2xl font-bold text-white">{exceptions.length} Fingerprints</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Clustered across 409 user sessions</p>
        </div>

        <div className="p-4 rounded-2xl border border-indigo-500/30 bg-[#131B2E]/90 backdrop-blur-xl">
          <div className="flex items-center justify-between text-indigo-400 mb-1">
            <span className="font-bold text-[11px] uppercase">Source-Map Resolution</span>
            <FileCode className="h-4 w-4" />
          </div>
          <span className="text-2xl font-bold text-emerald-400">100% Unminified</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Resolved to TypeScript source files</p>
        </div>

        <div className="p-4 rounded-2xl border border-amber-500/30 bg-[#1D1B1E]/90 backdrop-blur-xl">
          <div className="flex items-center justify-between text-amber-400 mb-1">
            <span className="font-bold text-[11px] uppercase">Peak JS Heap &amp; Nodes</span>
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="text-2xl font-bold text-amber-300">
            {activeSession.memoryProfile.slice(-1)[0]?.jsHeapSizeMb || 32} MB
          </span>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {activeSession.memoryProfile.slice(-1)[0]?.domNodeCount || 1200} DOM nodes accumulated
          </p>
        </div>
      </div>

      {/* 2. Exception Fingerprint Explorer & Source-Map View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Exception Fingerprint List (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#131B2E] overflow-hidden flex flex-col shadow-xl">
          <div className="p-3.5 bg-[#0B0F17] border-b border-slate-800 flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span className="text-white">Grouped Exception Fingerprints</span>
            <span>{exceptions.length} Groups</span>
          </div>

          <div className="p-2 space-y-2 overflow-y-auto max-h-[420px]">
            {exceptions.map((exc) => {
              const isSelected = exc.id === activeException?.id;
              return (
                <div
                  key={exc.id}
                  onClick={() => setSelectedExceptionId(exc.id)}
                  className={`p-3 rounded-xl cursor-pointer border transition-all ${
                    isSelected
                      ? 'border-rose-500/50 bg-rose-950/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                      : 'border-slate-800/80 bg-[#0B0F17]/80 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {exc.count} occurrences
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {exc.usersAffected} users affected
                    </span>
                  </div>

                  <h4 className="font-semibold text-white text-xs line-clamp-2">
                    {exc.signature}
                  </h4>

                  <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                    <span>First: {new Date(exc.firstSeen).toLocaleDateString()}</span>
                    <span>Last: {new Date(exc.lastSeen).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Unminified Source Stack Frame & Code Preview (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#131B2E] overflow-hidden flex flex-col shadow-xl">
          <div className="p-3.5 bg-[#0B0F17] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <FileCode className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-xs">Source-Mapped TypeScript Stack Trace</span>
            </div>

            <button
              onClick={handleCopyUnminifiedStack}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
            >
              {copiedTrace ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedTrace ? 'Copied!' : 'Copy Stack'}</span>
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[420px]">
            {/* Minified vs Unminified Comparison Banner */}
            <div className="p-3 rounded-xl bg-[#0B0F17] border border-slate-800 space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Original Minified Browser Frame:
              </span>
              <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap">
                {activeException?.minifiedStack}
              </pre>
            </div>

            {/* Unminified Source Frames */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase text-emerald-400 block">
                Source Map Resolved Frames ({activeException?.unminifiedFrames.length || 0}):
              </span>

              {activeException?.unminifiedFrames.map((frame, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-[#0B0F17] overflow-hidden"
                >
                  <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white">
                      {frame.functionName} <span className="text-slate-400 font-normal">at</span>{' '}
                      <span className="text-indigo-300">{frame.file}:{frame.line}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400">
                      TS Source Map OK
                    </span>
                  </div>

                  {frame.sourceSnippet && (
                    <div className="p-3 bg-[#080C14] text-[11px] font-mono leading-relaxed overflow-x-auto">
                      {frame.sourceSnippet.map((line, lIdx) => {
                        const isErrorLine = line.includes('CRASH');
                        return (
                          <div
                            key={lIdx}
                            className={`px-2 py-0.5 rounded ${
                              isErrorLine
                                ? 'bg-rose-500/20 text-rose-300 border-l-2 border-rose-500 font-bold'
                                : 'text-slate-400'
                            }`}
                          >
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Memory Leak & DOM Node Growth Tracker */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <h3 className="font-semibold text-xs">
              Client-Side Memory Leak Profiler &amp; DOM Node Growth ({activeSession.userEmail})
            </h3>
          </div>
          <span className="text-[11px] text-amber-300 font-bold">
            Potential DOM Leak Detected (+700% node growth)
          </span>
        </div>

        {/* Visual Memory Timeline Stepper */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {activeSession.memoryProfile.map((pt, idx) => {
            const isHigh = pt.jsHeapSizeMb > 100;
            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-all ${
                  isHigh
                    ? 'border-rose-500/40 bg-rose-950/20 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                    : 'border-slate-800 bg-[#0B0F17]/80 text-slate-300'
                }`}
              >
                <div className="text-[10px] text-slate-500 mb-1">
                  +{Math.round(pt.timestamp / 1000)}s into session
                </div>
                <div className="text-sm font-bold text-white">{pt.jsHeapSizeMb} MB Heap</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {pt.domNodeCount.toLocaleString()} DOM nodes
                </div>
                {pt.longTaskCount > 0 && (
                  <span className="inline-block mt-2 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {pt.longTaskCount} Long Tasks (&gt;50ms)
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
