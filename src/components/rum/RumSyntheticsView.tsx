'use client';

import React, { useState } from 'react';
import {
  Users,
  Video,
  FileCode,
  Gauge,
  Globe,
  Flame,
  Activity,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { SessionReplayViewer } from './SessionReplayViewer';
import { ExceptionTracker } from './ExceptionTracker';
import { WebVitalsTracker } from './WebVitalsTracker';
import { SyntheticMonitors } from './SyntheticMonitors';
import { useSessionTelemetry } from '../../hooks/useSessionTelemetry';

interface RumSyntheticsViewProps {
  onInspectTrace: (traceId: string) => void;
}

export const RumSyntheticsView: React.FC<RumSyntheticsViewProps> = ({
  onInspectTrace,
}) => {
  const [activeTab, setActiveTab] = useState<
    'replay' | 'exceptions' | 'vitals' | 'synthetics'
  >('replay');

  const {
    sessions,
    selectedSessionId,
    selectedSession,
    onSelectSession,
    exceptions,
    syntheticMonitors,
    runSyntheticMonitor,
    playbackPositionMs,
    setPlaybackPositionMs,
    isPlaying,
    togglePlay,
    playbackSpeed,
    setPlaybackSpeed,
    skipInactivity,
    toggleSkipInactivity,
  } = useSessionTelemetry();

  return (
    <div className="space-y-5 font-sans">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800/80 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2.5">
              Real User Monitoring (RUM) &amp; Synthetics Suite
              {selectedSession.frustrationScore > 70 && (
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  High Frustration Active
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Session Replay, Rage-Click Diagnostics, Source-Map Unminifier, Core Web Vitals, and Synthetic Canaries.
            </p>
          </div>
        </div>

        {/* Active Session Dropdown Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 hidden md:inline">Inspect Session:</span>
          <select
            value={selectedSessionId}
            onChange={(e) => onSelectSession(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-white text-xs font-mono font-semibold focus:outline-none focus:border-indigo-500"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.userEmail} ({s.device} • Score {s.frustrationScore}/100)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-[#0B0F17] border border-slate-800 w-fit font-mono text-xs">
        <button
          onClick={() => setActiveTab('replay')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'replay'
              ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Video className="h-4 w-4" />
          <span>Session Replay &amp; Rage-Clicks</span>
          {selectedSession.rageClicksCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
              {selectedSession.rageClicksCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('exceptions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'exceptions'
              ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileCode className="h-4 w-4 text-emerald-400" />
          <span>Source Maps &amp; Memory Profiler</span>
        </button>

        <button
          onClick={() => setActiveTab('vitals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'vitals'
              ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Gauge className="h-4 w-4 text-amber-400" />
          <span>Core Web Vitals &amp; Outliers</span>
        </button>

        <button
          onClick={() => setActiveTab('synthetics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'synthetics'
              ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="h-4 w-4 text-purple-400" />
          <span>Synthetic Monitoring Canaries</span>
        </button>
      </div>

      {/* Tab 1: Session Replay Viewer */}
      {activeTab === 'replay' && (
        <SessionReplayViewer
          session={selectedSession}
          playbackPositionMs={playbackPositionMs}
          onSeek={setPlaybackPositionMs}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          speed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          skipInactivity={skipInactivity}
          onToggleSkipInactivity={toggleSkipInactivity}
          onInspectTrace={onInspectTrace}
        />
      )}

      {/* Tab 2: Exception Tracker & Memory Profiler */}
      {activeTab === 'exceptions' && (
        <ExceptionTracker
          exceptions={exceptions}
          activeSession={selectedSession}
          onInspectTrace={onInspectTrace}
        />
      )}

      {/* Tab 3: Core Web Vitals Field Tracker */}
      {activeTab === 'vitals' && (
        <WebVitalsTracker
          sessions={sessions}
          activeSession={selectedSession}
          onSelectSession={onSelectSession}
          onInspectTrace={onInspectTrace}
        />
      )}

      {/* Tab 4: Synthetic Monitoring Canaries */}
      {activeTab === 'synthetics' && (
        <SyntheticMonitors
          monitors={syntheticMonitors}
          onRunMonitor={runSyntheticMonitor}
          onInspectTrace={onInspectTrace}
        />
      )}
    </div>
  );
};
