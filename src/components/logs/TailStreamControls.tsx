'use client';

import React from 'react';
import {
  Play,
  Pause,
  Lock,
  Unlock,
  Activity,
  Gauge,
  AlertTriangle,
  History,
  Download,
  Filter,
  Flame,
} from 'lucide-react';

interface TailStreamControlsProps {
  isPaused: boolean;
  onTogglePause: () => void;
  isAutoScrollLocked: boolean;
  onToggleAutoScroll: () => void;
  ingestionRate: number; // logs/sec
  samplingMode: 'full' | 'sampled';
  onToggleSampling: () => void;
  backpressureRatio: number; // 0.1 to 1.0
  hasRecent5xxBurst: boolean;
  recent5xxCount: number;
  isTimeTraveling: boolean;
  timeTravelOffset: number; // in seconds
  onOpenTimeTravel: () => void;
  onOpenExportModal: () => void;
  totalLogsCount: number;
  filteredLogsCount: number;
  pausedQueuedCount?: number;
}

export const TailStreamControls: React.FC<TailStreamControlsProps> = ({
  isPaused,
  onTogglePause,
  isAutoScrollLocked,
  onToggleAutoScroll,
  ingestionRate,
  samplingMode,
  onToggleSampling,
  backpressureRatio,
  hasRecent5xxBurst,
  recent5xxCount,
  isTimeTraveling,
  timeTravelOffset,
  onOpenTimeTravel,
  onOpenExportModal,
  totalLogsCount,
  filteredLogsCount,
  pausedQueuedCount = 0,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-800/80 bg-[#131B2E]/90 backdrop-blur-xl shadow-lg font-mono text-xs">
      {/* Left section: Stream Toggle & Auto-Scroll Lock */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Stream Status Toggle Button */}
        <button
          onClick={onTogglePause}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-semibold border transition-all ${
            isPaused
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
          }`}
          title={isPaused ? 'Resume live log stream' : 'Pause log stream for inspection'}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isPaused ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isPaused ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          <span>{isPaused ? 'Stream Paused' : 'Live Tailing'}</span>
          {isPaused && pausedQueuedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-200 border border-amber-500/30">
              +{pausedQueuedCount} queued
            </span>
          )}
        </button>

        {/* Auto-Scroll Lock Toggle */}
        <button
          onClick={onToggleAutoScroll}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
            isAutoScrollLocked
              ? 'bg-indigo-600/25 text-indigo-300 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
              : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
          }`}
          title="Toggle auto-scrolling to newest log events"
        >
          {isAutoScrollLocked ? (
            <Lock className="h-3.5 w-3.5 text-indigo-400" />
          ) : (
            <Unlock className="h-3.5 w-3.5 text-slate-500" />
          )}
          <span>Auto-Scroll {isAutoScrollLocked ? 'Locked' : 'Unlocked'}</span>
        </button>

        {/* Time-Travel Trigger Indicator */}
        <button
          onClick={onOpenTimeTravel}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
            isTimeTraveling
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
              : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-white hover:border-slate-600'
          }`}
          title="Open zero-copy time scrubber to inspect historical buffer windows"
        >
          <History className="h-3.5 w-3.5 text-purple-400" />
          <span>
            {isTimeTraveling ? `Time-Travel (-${timeTravelOffset}s)` : 'Time-Travel Scrubber'}
          </span>
        </button>
      </div>

      {/* Center / Right section: Ingestion Rate, Backpressure Gauge & 5xx Chime */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Anomaly Burst Visual Chime */}
        {hasRecent5xxBurst && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse">
            <Flame className="h-3.5 w-3.5 text-rose-400" />
            <span className="font-bold text-[11px]">
              5xx Fault Burst ({recent5xxCount} errors in 5s)
            </span>
          </div>
        )}

        {/* Live Throughput Counter */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0B0F17]/80 border border-slate-800 text-slate-300">
          <Activity className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
          <span>
            <strong className="text-white">{ingestionRate}</strong> logs/sec
          </span>
        </div>

        {/* Backpressure & Sampling Gauge Button */}
        <button
          onClick={onToggleSampling}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
            samplingMode === 'sampled'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : 'bg-[#0B0F17]/80 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
          title="Toggle between Full Stream (1:1) and Backpressure Sampling (1:10)"
        >
          <Gauge className="h-3.5 w-3.5 text-emerald-400" />
          <span>
            Sampling: <strong>{samplingMode === 'full' ? '1:1 Full Stream' : '1:10 Sampled'}</strong>
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
              backpressureRatio < 0.5
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {Math.round(backpressureRatio * 100)}%
          </span>
        </button>

        {/* Advanced Log Export Studio Trigger */}
        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-[0_0_15px_rgba(99,102,241,0.35)] border border-indigo-400/40 transition-all"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Studio</span>
        </button>
      </div>
    </div>
  );
};
