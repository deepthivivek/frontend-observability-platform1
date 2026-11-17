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

  if (!selectedSession) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center space-y-3">
        <Users className="h-8 w-8 text-indigo-500 dark:text-indigo-400 mx-auto" />
        <h2 className="text-base font-semibold text-customText">
          Real User Monitoring (RUM) &amp; Live Session Replay
        </h2>
        <p className="text-xs text-mutedText max-w-md mx-auto">
          No live OTLP or RUM telemetry sessions have been ingested yet. Stream OpenTelemetry payloads to{' '}
          <code className="font-mono text-indigo-600 dark:text-indigo-400">POST /api/v1/telemetry</code>{' '}
          to inspect live user journeys and Core Web Vitals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans">
      {/* Top Header Bar */}
      <div className="glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/30">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-customText flex items-center gap-2.5">
              Real User Monitoring (RUM) &amp; Probes
              {selectedSession.frustrationScore > 70 && (
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40">
                  High Frustration Active
                </span>
              )}
            </h1>
            <p className="text-xs text-mutedText mt-0.5 font-mono">
              Live OTLP Session Replay, Source-Map Unminifier, Core Web Vitals, and Edge Probe Targets.
            </p>
          </div>
        </div>

        {/* Active Session Dropdown Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-mutedText hidden md:inline">Inspect Session:</span>
          <select
            value={selectedSessionId}
            onChange={(e) => onSelectSession(e.target.value)}
            className="px-3 py-2 rounded-xl border border-subtleBorder bg-surface text-customText text-xs font-mono font-semibold focus:outline-none focus:border-indigo-500"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.userEmail} ({s.device} · Score {s.frustrationScore}/100)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-surface border border-subtleBorder w-fit font-mono text-xs">
        <button
          onClick={() => setActiveTab('replay')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'replay'
              ? 'bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/40'
              : 'text-mutedText hover:text-customText'
          }`}
        >
          <Video className="h-4 w-4" />
          <span>Session Replay</span>
          {selectedSession.rageClicksCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold">
              {selectedSession.rageClicksCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('exceptions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'exceptions'
              ? 'bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/40'
              : 'text-mutedText hover:text-customText'
          }`}
        >
          <FileCode className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          <span>Source Maps &amp; Memory</span>
        </button>

        <button
          onClick={() => setActiveTab('vitals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'vitals'
              ? 'bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/40'
              : 'text-mutedText hover:text-customText'
          }`}
        >
          <Gauge className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          <span>Core Web Vitals</span>
        </button>

        <button
          onClick={() => setActiveTab('synthetics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'synthetics'
              ? 'bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/40'
              : 'text-mutedText hover:text-customText'
          }`}
        >
          <Globe className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
          <span>Edge Probe Monitors</span>
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

      {/* Tab 4: Live Edge Probe Monitors */}
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
