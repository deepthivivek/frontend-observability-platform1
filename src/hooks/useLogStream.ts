'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ApiRequestLog } from '../types/telemetry';
import { ExportOptions } from '../types/logStream';
import { generateLogExport } from '../utils/logExportUtils';

interface UseLogStreamOptions {
  maxBufferTimeMinutes?: number; // e.g. 30 mins
}

export function useLogStream(
  incomingLogs: ApiRequestLog[],
  options: UseLogStreamOptions = {}
) {
  const maxBufferTimeMinutes = options.maxBufferTimeMinutes ?? 30;

  const [isPaused, setIsPaused] = useState(false);
  const [isAutoScrollLocked, setIsAutoScrollLocked] = useState(true);
  const [samplingMode, setSamplingMode] = useState<'full' | 'sampled'>('full');
  const [timeTravelOffset, setTimeTravelOffset] = useState<number>(0); // 0 = live, in seconds
  const [frozenLogs, setFrozenLogs] = useState<ApiRequestLog[]>(incomingLogs);

  // Track throughput calculation (logs/sec) via refs inside interval callback
  const [ingestionRate, setIngestionRate] = useState<number>(0);
  const throughputTrackerRef = useRef<{ lastCount: number; lastTime: number }>({
    lastCount: incomingLogs.length,
    lastTime: 0,
  });

  // Pure derived 5xx burst detection
  const recent5xxCount = useMemo(() => {
    return incomingLogs.filter((l) => l.statusCode >= 500).length;
  }, [incomingLogs]);

  const hasRecent5xxBurst = recent5xxCount >= 3;

  // Pure derived queued logs count while paused
  const pausedQueuedCount = useMemo(() => {
    if (!isPaused && timeTravelOffset === 0) return 0;
    return Math.max(0, incomingLogs.length - frozenLogs.length);
  }, [isPaused, timeTravelOffset, incomingLogs.length, frozenLogs.length]);

  // Compute live throughput logs/second inside interval
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const tracker = throughputTrackerRef.current;
      if (tracker.lastTime === 0) {
        tracker.lastTime = now;
        tracker.lastCount = incomingLogs.length;
        return;
      }

      const elapsedSec = (now - tracker.lastTime) / 1000;
      if (elapsedSec > 0) {
        const delta = Math.max(0, incomingLogs.length - tracker.lastCount);
        const rate = Math.round(delta / elapsedSec);
        setIngestionRate(rate);
      }
      tracker.lastCount = incomingLogs.length;
      tracker.lastTime = now;
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingLogs.length]);

  // Pause / Resume toggle
  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (!next) {
        // Resuming: unfreeze logs and clear offset
        setFrozenLogs(incomingLogs);
        setTimeTravelOffset(0);
      } else {
        // Pausing: freeze current logs state
        setFrozenLogs(incomingLogs);
      }
      return next;
    });
  }, [incomingLogs]);

  // Auto-scroll toggle
  const toggleAutoScrollLock = useCallback(() => {
    setIsAutoScrollLocked((prev) => !prev);
  }, []);

  // Sampling toggle
  const toggleSamplingMode = useCallback(() => {
    setSamplingMode((prev) => (prev === 'full' ? 'sampled' : 'full'));
  }, []);

  // Time travel scrubber change
  const handleSetTimeTravel = useCallback(
    (offsetSec: number) => {
      setTimeTravelOffset(offsetSec);
      if (offsetSec > 0) {
        setIsPaused(true);
        setFrozenLogs(incomingLogs);
      }
    },
    [incomingLogs]
  );

  const resetTimeTravel = useCallback(() => {
    setTimeTravelOffset(0);
    setIsPaused(false);
    setFrozenLogs(incomingLogs);
  }, [incomingLogs]);

  // Compute visible logs based on sampling and time-travel offset
  const visibleLogs = useMemo(() => {
    const sourceLogs = isPaused || timeTravelOffset > 0 ? frozenLogs : incomingLogs;

    let filtered = sourceLogs;

    // Apply Time-Travel offset: show logs up to (newest - offsetSec)
    if (timeTravelOffset > 0 && sourceLogs.length > 0) {
      const newestTime = sourceLogs[0]?.timestamp ?? 0;
      const targetTime = newestTime - timeTravelOffset * 1000;
      filtered = sourceLogs.filter((l) => l.timestamp <= targetTime);
    }

    // Apply sampling mode (1:10)
    if (samplingMode === 'sampled') {
      filtered = filtered.filter((_, idx) => idx % 10 === 0);
    }

    return filtered;
  }, [incomingLogs, frozenLogs, isPaused, timeTravelOffset, samplingMode]);

  const backpressureRatio = useMemo(() => {
    if (samplingMode === 'sampled') return 0.1;
    if (ingestionRate > 150) return 0.75;
    return 1.0;
  }, [samplingMode, ingestionRate]);

  // Export helper
  const exportLogs = useCallback(
    (logsToExport: ApiRequestLog[], exportOptions: ExportOptions) => {
      return generateLogExport(logsToExport, exportOptions);
    },
    []
  );

  return {
    isPaused,
    setIsPaused,
    togglePause,
    isAutoScrollLocked,
    toggleAutoScrollLock,
    samplingMode,
    toggleSamplingMode,
    timeTravelOffset,
    setTimeTravelOffset: handleSetTimeTravel,
    resetTimeTravel,
    isTimeTraveling: timeTravelOffset > 0,
    maxBufferTimeMinutes,
    ingestionRate,
    backpressureRatio,
    recent5xxCount,
    hasRecent5xxBurst,
    pausedQueuedCount,
    visibleLogs,
    exportLogs,
  };
}
