'use client';

import React from 'react';
import {
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Flame,
  MousePointer,
  AlertCircle,
  ExternalLink,
  Clock,
  Activity,
  Layers,
  Sparkles,
  Wifi,
  Smartphone,
  Monitor,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { RumSession, DomEvent } from '../../types/rum';

interface SessionReplayViewerProps {
  session: RumSession;
  playbackPositionMs: number;
  onSeek: (ms: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  skipInactivity: boolean;
  onToggleSkipInactivity: () => void;
  onInspectTrace: (traceId: string) => void;
}

export const SessionReplayViewer: React.FC<SessionReplayViewerProps> = ({
  session,
  playbackPositionMs,
  onSeek,
  isPlaying,
  onTogglePlay,
  speed,
  onSpeedChange,
  skipInactivity,
  onToggleSkipInactivity,
  onInspectTrace,
}) => {
  const progressPct = Math.min(
    100,
    Math.max(0, (playbackPositionMs / (session.durationMs || 1)) * 100)
  );

  // Active event closest to current seek
  const currentEvent =
    session.events.filter((e) => e.timestamp <= playbackPositionMs).pop() ||
    session.events[0];

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const SPEED_OPTIONS = [1, 2, 4, 8];

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* 1. Frustration Analytics Top Banner */}
      <div
        className={`p-4 rounded-2xl border backdrop-blur-xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl ${
          session.frustrationScore > 70
            ? 'border-rose-500/50 bg-[#1F1422]/90 shadow-[0_0_25px_rgba(244,63,94,0.18)]'
            : session.frustrationScore > 40
            ? 'border-amber-500/50 bg-[#1E1B1F]/90 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
            : 'border-emerald-500/40 bg-[#131F25]/90'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`p-3 rounded-xl border flex items-center justify-center ${
              session.frustrationScore > 70
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}
          >
            <Flame className="h-6 w-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white font-sans">
                Session Frustration Score:
              </span>
              <span
                className={`text-base font-extrabold px-2.5 py-0.5 rounded-full border ${
                  session.frustrationScore > 70
                    ? 'bg-rose-500/30 text-rose-300 border-rose-500/50'
                    : session.frustrationScore > 40
                    ? 'bg-amber-500/30 text-amber-300 border-amber-500/50'
                    : 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
                }`}
              >
                {session.frustrationScore}/100
              </span>
              <span className="text-slate-400 text-xs">
                {session.frustrationScore > 70
                  ? '(High Rage & Failure Cluster)'
                  : session.frustrationScore > 40
                  ? '(Moderate UI Friction)'
                  : '(Smooth User Journey)'}
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-1">
              Detected <strong>{session.rageClicksCount} Rage Clicks</strong>,{' '}
              <strong>{session.deadClicksCount} Dead Clicks</strong>, and{' '}
              <strong>{session.errorsCount} Uncaught Exceptions</strong> during this session.
            </p>
          </div>
        </div>

        {/* User Session Meta & Deep-Link */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-[#0B0F17]/80 border border-slate-800 text-slate-300 text-[11px]">
            <span>User: </span>
            <strong className="text-white">{session.userEmail}</strong> ({session.country})
          </div>

          <button
            onClick={() => onInspectTrace(session.correlatedTraceId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] border border-indigo-400/40"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Inspect Correlated Trace</span>
          </button>
        </div>
      </div>

      {/* 2. Visual Replay Canvas + Synchronized Telemetry Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Interactive Simulated DOM Playback Screen (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#131B2E] overflow-hidden flex flex-col shadow-2xl">
          {/* Simulated Browser Address & Tab Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#0B0F17] border-b border-slate-800 text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-[10px] text-slate-500 font-bold uppercase">
                DOM Mutation Player
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] max-w-sm truncate">
              <span className="text-indigo-400">https://app.observability.io</span>
              <span className="text-white font-semibold">
                {currentEvent?.type === 'navigation'
                  ? currentEvent.targetText
                  : '/checkout/review-order'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>PII Masked</span>
            </div>
          </div>

          {/* Interactive Simulated DOM Screen */}
          <div className="relative flex-1 min-h-[340px] p-6 bg-[#0B0F17]/95 flex flex-col justify-between select-none">
            {/* Mock Checkout View Rendering */}
            <div className="space-y-4 max-w-md mx-auto w-full">
              <div className="p-3.5 rounded-xl border border-slate-800 bg-[#131B2E]/90 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-xs">Review Order #88219</h4>
                  <span className="text-slate-400 text-[10px]">
                    Enterprise Observability License (1 Year)
                  </span>
                </div>
                <span className="text-emerald-400 font-bold text-sm">$1,250.00</span>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 uppercase font-bold block">
                  Billing Postal Code
                </label>
                <div className="p-2.5 rounded-xl border border-slate-800 bg-[#1E293B]/70 text-white font-mono text-xs">
                  {playbackPositionMs >= 3400 ? '94107' : ''}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 uppercase font-bold block">
                  Credit Card Number (Auto-Masked for Security)
                </label>
                <div className="p-2.5 rounded-xl border border-slate-800 bg-[#1E293B]/70 text-slate-300 font-mono text-xs flex items-center justify-between">
                  <span>{playbackPositionMs >= 5600 ? '•••• •••• •••• 4242' : ''}</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    Encrypted
                  </span>
                </div>
              </div>

              {/* Place Order CTA Button */}
              <div className="relative pt-2">
                <button
                  type="button"
                  id="btn-place-order"
                  className={`w-full py-3 rounded-xl font-bold text-xs text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                    playbackPositionMs >= 10100
                      ? 'bg-rose-600/80 border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                      : 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/40 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                  }`}
                >
                  {playbackPositionMs >= 10100 ? (
                    <>
                      <Flame className="h-4 w-4 text-rose-300 animate-bounce" />
                      <span>Rage-Clicking CTA Button (6x)</span>
                    </>
                  ) : (
                    <span>Complete Purchase ($1,250.00)</span>
                  )}
                </button>

                {/* Dead Click Banner Simulation */}
                {playbackPositionMs >= 16000 && (
                  <div className="mt-3 p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-[11px] text-center font-sans">
                    <strong>Dead Click Detected:</strong> Clicked static promo banner with no click handler.
                  </div>
                )}
              </div>
            </div>

            {/* Mouse Cursor Visual Simulation with Neon Ripple */}
            {currentEvent?.x && currentEvent?.y && (
              <div
                className="absolute pointer-events-none transition-all duration-150 z-30"
                style={{
                  left: `${(currentEvent.x / 800) * 100}%`,
                  top: `${(currentEvent.y / 600) * 100}%`,
                }}
              >
                <div className="relative">
                  <MousePointer className="h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)] fill-indigo-500" />
                  {currentEvent.type === 'rage_click' ? (
                    <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-rose-500/50 border-2 border-rose-400 animate-ping" />
                  ) : currentEvent.type === 'click' ? (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-indigo-500/40 border border-indigo-400 animate-ping" />
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Synchronized Telemetry Waterfall & Event Stream (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#131B2E] overflow-hidden flex flex-col shadow-2xl">
          <div className="px-4 py-2.5 bg-[#0B0F17] border-b border-slate-800 flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span className="flex items-center gap-2 text-white">
              <Activity className="h-4 w-4 text-indigo-400" />
              Synchronized Telemetry Waterfall
            </span>
            <span>{session.events.length} Timeline Events</span>
          </div>

          <div className="p-3 divide-y divide-slate-800/60 overflow-y-auto max-h-[380px]">
            {session.events.map((evt) => {
              const isPastOrActive = evt.timestamp <= playbackPositionMs;
              const isRage = evt.type === 'rage_click';
              const isError = evt.type === 'error';
              const isNetwork = evt.type === 'network_call';

              return (
                <div
                  key={evt.id}
                  onClick={() => onSeek(evt.timestamp)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start justify-between gap-2 ${
                    isPastOrActive
                      ? isError
                        ? 'bg-rose-950/30 text-rose-200 border border-rose-500/30'
                        : isRage
                        ? 'bg-amber-950/25 text-amber-200 border border-amber-500/30'
                        : 'bg-[#0B0F17]/80 text-slate-200 hover:bg-slate-800/40'
                      : 'opacity-40 hover:opacity-70 text-slate-500'
                  }`}
                >
                  <div className="space-y-0.5 max-w-[80%]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                          isError
                            ? 'bg-rose-500/30 text-rose-300'
                            : isRage
                            ? 'bg-amber-500/30 text-amber-300'
                            : isNetwork
                            ? 'bg-emerald-500/30 text-emerald-300'
                            : 'bg-indigo-500/30 text-indigo-300'
                        }`}
                      >
                        {evt.type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400">+{formatMs(evt.timestamp)}</span>
                    </div>

                    <div className="text-[11px] font-semibold text-white truncate">
                      {evt.targetText || evt.targetSelector}
                    </div>

                    {isNetwork && evt.networkDetails && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span
                          className={`font-bold ${
                            evt.networkDetails.status >= 500 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {evt.networkDetails.status}
                        </span>
                        <span>{evt.networkDetails.url}</span>
                        <span className="text-amber-400">({evt.networkDetails.durationMs}ms)</span>
                      </div>
                    )}

                    {isError && evt.errorMessage && (
                      <div className="text-[10px] text-rose-300 font-sans line-clamp-2">
                        {evt.errorMessage}
                      </div>
                    )}
                  </div>

                  {isPastOrActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 self-center" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Replay Controls & Interactive Keyframe Scrubber */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-3">
        {/* Scrubber Bar with Keyframe Dots */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-bold text-white">{formatMs(playbackPositionMs)}</span>
            <span className="text-slate-500">Duration: {formatMs(session.durationMs)}</span>
          </div>

          <div className="relative pt-1 pb-1">
            <input
              type="range"
              min={0}
              max={session.durationMs}
              step={100}
              value={playbackPositionMs}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
            />

            {/* Keyframe Marker Dots */}
            <div className="absolute inset-x-0 top-3 pointer-events-none flex items-center">
              {session.events.map((evt) => {
                const pct = (evt.timestamp / (session.durationMs || 1)) * 100;
                const dotColor =
                  evt.type === 'error'
                    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                    : evt.type === 'rage_click'
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                    : evt.type === 'network_call'
                    ? 'bg-emerald-400'
                    : 'bg-indigo-400';

                return (
                  <span
                    key={evt.id}
                    style={{ left: `${pct}%` }}
                    className={`absolute -translate-x-1/2 h-2.5 w-2.5 rounded-full ${dotColor}`}
                    title={`${evt.type} at +${formatMs(evt.timestamp)}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Playback Button Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
            </button>

            <button
              onClick={() => onSeek(0)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Restart Replay"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Speed & Inactivity Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-[#0B0F17] p-1 rounded-xl border border-slate-800">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSpeedChange(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    speed === s
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button
              onClick={onToggleSkipInactivity}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                skipInactivity
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700'
              }`}
            >
              <FastForward className="h-3.5 w-3.5" />
              <span>Skip Inactivity</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
