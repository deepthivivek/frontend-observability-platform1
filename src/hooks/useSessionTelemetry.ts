'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  RumSession,
  UncaughtExceptionGroup,
  SyntheticMonitor,
} from '../types/rum';

export function useSessionTelemetry() {
  const [sessions, setSessions] = useState<RumSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [exceptions, setExceptions] = useState<UncaughtExceptionGroup[]>([]);
  const [syntheticMonitors, setSyntheticMonitors] = useState<SyntheticMonitor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [probesRes, telemetryRes] = await Promise.all([
          fetch('/api/v1/synthetic/probes', { cache: 'no-store' }).catch(() => null),
          fetch('/api/v1/telemetry/recent?limit=100', { cache: 'no-store' }).catch(() => null),
        ]);

        if (!active) return;

        if (probesRes?.ok) {
          const probeJson = (await probesRes.json()) as {
            probes?: Array<{
              id: string;
              name: string;
              targetUrl: string;
              intervalSeconds?: number;
              overallStatus?: string;
              lastRunAt?: number;
            }>;
          };
          if (Array.isArray(probeJson.probes)) {
            setSyntheticMonitors(
              probeJson.probes.map((p) => ({
                id: p.id,
                name: p.name,
                targetUrl: p.targetUrl,
                frequencyMinutes: Math.max(1, Math.round((p.intervalSeconds || 60) / 60)),
                status: p.overallStatus === 'HEALTHY' ? 'passing' : 'failing',
                lastRunTimestamp: p.lastRunAt || Date.now(),
                regions: [],
                steps: [],
              }))
            );
          }
        }

        if (telemetryRes?.ok) {
          const telJson = (await telemetryRes.json()) as {
            records?: Array<{
              id: string;
              timestamp: number;
              tenantId?: string;
              endpoint: string;
              statusCode: number;
              latencyMs: number;
              traceId: string;
              method: string;
            }>;
          };
          if (Array.isArray(telJson.records) && telJson.records.length > 0) {
            const groupedSession: RumSession = {
              id: `otlp-live-${telJson.records[0].traceId}`,
              userId: telJson.records[0].tenantId || 'default-tenant',
              userEmail: `${telJson.records[0].tenantId || 'default-tenant'}@otlp-live`,
              startTime: telJson.records[0].timestamp,
              durationMs: Math.max(1000, telJson.records[telJson.records.length - 1].timestamp - telJson.records[0].timestamp),
              device: 'Desktop',
              browser: 'OTLP Collector',
              os: 'Linux',
              networkTier: 'WiFi',
              country: 'US',
              frustrationScore: telJson.records.some((r) => r.statusCode >= 500) ? 75 : 10,
              rageClicksCount: 0,
              deadClicksCount: 0,
              errorsCount: telJson.records.filter((r) => r.statusCode >= 500).length,
              correlatedTraceId: telJson.records[0].traceId,
              events: telJson.records.slice(0, 25).map((r, idx) => ({
                id: r.id || `evt-${idx}`,
                timestamp: Math.max(0, r.timestamp - telJson.records![0].timestamp),
                type: 'network_call',
                targetSelector: r.endpoint,
                networkDetails: {
                  method: r.method,
                  url: r.endpoint,
                  status: r.statusCode,
                  durationMs: r.latencyMs,
                  traceId: r.traceId,
                },
              })),
              webVitals: {
                lcp: Math.round(telJson.records.reduce((a, r) => a + r.latencyMs, 0) / telJson.records.length),
                inp: 45,
                cls: 0.01,
                fcp: 200,
                ttfb: Math.round(telJson.records[0].latencyMs || 15),
                slowElement: telJson.records[0].endpoint,
                networkLatencyAttribution: telJson.records[0].latencyMs,
                loafDuration: 12,
              },
              memoryProfile: [],
            };
            setSessions([groupedSession]);
            setSelectedSessionId(groupedSession.id);
          }
        }
        setExceptions([]);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const [playbackPositionMs, setPlaybackPositionMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [skipInactivity, setSkipInactivity] = useState<boolean>(true);

  const selectedSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  const currentVisibleEvents = useMemo(() => {
    if (!selectedSession) return [];
    return selectedSession.events.filter((e) => e.timestamp <= playbackPositionMs);
  }, [selectedSession, playbackPositionMs]);

  const activeEvent = useMemo(() => {
    if (!selectedSession) return null;
    return [...currentVisibleEvents].reverse()[0] || selectedSession.events[0] || null;
  }, [currentVisibleEvents, selectedSession]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setSelectedSessionId(id);
    setPlaybackPositionMs(0);
    setIsPlaying(false);
  }, []);

  const runSyntheticMonitor = useCallback(async (monitorId: string) => {
    const target = syntheticMonitors.find((m) => m.id === monitorId);
    if (!target) return;
    try {
      const res = await fetch(
        `/api/v1/synthetic/probe/run?url=${encodeURIComponent(target.targetUrl)}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        setSyntheticMonitors((prev) =>
          prev.map((m) =>
            m.id === monitorId
              ? { ...m, status: 'passing', lastRunTimestamp: Date.now() }
              : m
          )
        );
      }
    } catch {
      // Non-fatal probe trigger
    }
  }, [syntheticMonitors]);

  return {
    sessions,
    selectedSessionId,
    selectedSession,
    isLoading,
    onSelectSession: handleSelectSession,
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
    toggleSkipInactivity: () => setSkipInactivity((prev) => !prev),
    currentVisibleEvents,
    activeEvent,
  };
}
