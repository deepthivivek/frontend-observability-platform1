'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  RumSession,
  UncaughtExceptionGroup,
  SyntheticMonitor,
} from '../types/rum';
import {
  SEED_RUM_SESSIONS,
  SEED_EXCEPTIONS,
  SEED_SYNTHETIC_MONITORS,
} from '../utils/rumSyntheticData';

export function useSessionTelemetry() {
  const [sessions, setSessions] = useState<RumSession[]>(SEED_RUM_SESSIONS);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    SEED_RUM_SESSIONS[0].id
  );
  const [exceptions, setExceptions] = useState<UncaughtExceptionGroup[]>(SEED_EXCEPTIONS);
  const [syntheticMonitors, setSyntheticMonitors] =
    useState<SyntheticMonitor[]>(SEED_SYNTHETIC_MONITORS);

  // Playback Player State
  const [playbackPositionMs, setPlaybackPositionMs] = useState<number>(10200);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [skipInactivity, setSkipInactivity] = useState<boolean>(true);

  const selectedSession = useMemo(() => {
    return (
      sessions.find((s) => s.id === selectedSessionId) || sessions[0]
    );
  }, [sessions, selectedSessionId]);

  // Derived current visible events up to current playback timestamp
  const currentVisibleEvents = useMemo(() => {
    return selectedSession.events.filter((e) => e.timestamp <= playbackPositionMs);
  }, [selectedSession, playbackPositionMs]);

  // Derived active event closest to playback position
  const activeEvent = useMemo(() => {
    return (
      [...currentVisibleEvents].reverse()[0] || selectedSession.events[0]
    );
  }, [currentVisibleEvents, selectedSession.events]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setSelectedSessionId(id);
    setPlaybackPositionMs(0);
    setIsPlaying(false);
  }, []);

  // Run a synthetic test monitor simulation
  const runSyntheticMonitor = useCallback((monitorId: string) => {
    setSyntheticMonitors((prev) =>
      prev.map((m) => {
        if (m.id !== monitorId) return m;
        return {
          ...m,
          status: 'passing',
          lastRunTimestamp: 1700000000000,
          steps: m.steps.map((st) => ({
            ...st,
            status: 'passed',
            assertionMessage: undefined,
          })),
          regions: m.regions.map((r) => ({
            ...r,
            status: 'ok',
            latencyMs: Math.round(r.latencyMs * 0.85),
          })),
        };
      })
    );
  }, []);

  return {
    sessions,
    selectedSessionId,
    selectedSession,
    onSelectSession: handleSelectSession,
    exceptions,
    syntheticMonitors,
    runSyntheticMonitor,
    // Playback state
    playbackPositionMs,
    setPlaybackPositionMs,
    isPlaying,
    togglePlay,
    playbackSpeed,
    setPlaybackSpeed,
    skipInactivity,
    toggleSkipInactivity: () => setSkipInactivity((prev) => !prev),
    currentVisibleEvents,
    activeEvent,
  };
}
