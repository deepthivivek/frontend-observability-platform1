'use client';

import React from 'react';
import {
  History,
  RotateCcw,
  Play,
  Pause,
  FastForward,
  Rewind,
  Clock,
  Radio,
  X,
  Lock,
} from 'lucide-react';

interface StreamTimeTravelProps {
  isOpen: boolean;
  onClose: () => void;
  timeTravelOffset: number; // in seconds
  onOffsetChange: (offsetSeconds: number) => void;
  onResetLive: () => void;
  maxBufferMinutes?: number;
  totalLogsCount: number;
  visibleLogsCount: number;
  newestLogTimestamp?: number;
}

export const StreamTimeTravel: React.FC<StreamTimeTravelProps> = ({
  isOpen,
  onClose,
  timeTravelOffset,
  onOffsetChange,
  onResetLive,
  maxBufferMinutes = 30,
  totalLogsCount,
  visibleLogsCount,
  newestLogTimestamp = 0,
}) => {
  if (!isOpen) return null;

  const maxSeconds = maxBufferMinutes * 60; // 1800s
  const isLive = timeTravelOffset === 0;

  // Compute calculated timestamp at cursor
  const cursorTimestamp = newestLogTimestamp > 0 ? newestLogTimestamp - timeTravelOffset * 1000 : 0;

  const formatOffsetLabel = (sec: number) => {
    if (sec === 0) return 'Live Stream (0s)';
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    if (mins === 0) return `-${remSec}s ago`;
    return `-${mins}m ${remSec > 0 ? `${remSec}s ` : ''}ago`;
  };

  const PRESETS = [
    { label: 'Live', seconds: 0 },
    { label: '-30s', seconds: 30 },
    { label: '-1m', seconds: 60 },
    { label: '-5m', seconds: 300 },
    { label: '-15m', seconds: 900 },
    { label: '-30m', seconds: 1800 },
  ];

  return (
    <div className="rounded-2xl border border-purple-500/40 bg-[#171224]/90 p-4 backdrop-blur-xl shadow-[0_0_25px_rgba(168,85,247,0.15)] font-mono text-xs space-y-3">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Time-Travel Buffer Scrubber
              {!isLive && (
                <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Buffer Locked
                </span>
              )}
            </h3>
            <p className="text-[11px] text-purple-200/70">
              Zero-copy rewind through memory buffer without losing real-time worker ingestion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isLive && (
            <button
              onClick={onResetLive}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all shadow-[0_0_12px_rgba(168,85,247,0.3)]"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Return to Live</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close scrubber panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrubber slider and indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-bold text-white">{formatOffsetLabel(timeTravelOffset)}</span>
            <span className="text-slate-500">•</span>
            <span className="text-purple-300">
              {cursorTimestamp > 0 ? new Date(cursorTimestamp).toLocaleTimeString() : 'Live Window'}
            </span>
          </div>

          <div className="text-slate-400">
            Showing <strong className="text-white">{visibleLogsCount}</strong> of {totalLogsCount} buffer logs
          </div>
        </div>

        {/* Range Slider */}
        <div className="relative pt-1 pb-1">
          <input
            type="range"
            min={0}
            max={maxSeconds}
            step={5}
            value={timeTravelOffset}
            onChange={(e) => onOffsetChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>Live (Now)</span>
            <span>-15 mins</span>
            <span>-30 mins Max Window</span>
          </div>
        </div>
      </div>

      {/* Preset Quick Scrub Buttons & Replay Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">Presets:</span>
          {PRESETS.map((p) => {
            const isActive = timeTravelOffset === p.seconds;
            return (
              <button
                key={p.label}
                onClick={() => onOffsetChange(p.seconds)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    : 'bg-[#0B0F17] text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Step backward / forward micro-buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onOffsetChange(Math.min(maxSeconds, timeTravelOffset + 10))}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
            title="Step backward 10s"
          >
            <Rewind className="h-3 w-3 text-purple-400" />
            <span>-10s</span>
          </button>

          <button
            onClick={() => onOffsetChange(Math.max(0, timeTravelOffset - 10))}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
            title="Step forward 10s"
          >
            <FastForward className="h-3 w-3 text-purple-400" />
            <span>+10s</span>
          </button>
        </div>
      </div>
    </div>
  );
};
