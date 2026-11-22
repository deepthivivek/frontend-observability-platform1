'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type TelemetryStreamTransport = 'websocket' | 'sse' | 'polling' | 'offline';
export type TelemetryConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'degraded' | 'offline';

export interface TelemetryStreamEvent {
  type:
    | 'handshake_ack'
    | 'trace_anomaly_detected'
    | 'topology_updated'
    | 'telemetry_tick'
    | 'akasha_converged'
    | 'incident_updated'
    | 'pong'
    | string;
  payload: unknown;
  timestamp: number;
}

export interface OptimisticActionRecord {
  id: string;
  label: string;
  status: 'optimistic' | 'committed' | 'rolled_back';
  startedAt: number;
}

export interface TelemetryStreamSnapshot {
  status: TelemetryConnectionStatus;
  transport: TelemetryStreamTransport;
  reconnectAttempt: number;
  lastHeartbeatRttMs: number | null;
  eventsReceived: number;
  latestTick: {
    processedLogs: number;
    traceId: string;
    throughputEstimateRps: number;
    timestamp: number;
  } | null;
  recentEvents: TelemetryStreamEvent[];
}

interface UseTelemetryStreamOptions {
  enabled?: boolean;
  wsUrl?: string;
  sseUrl?: string;
  heartbeatIntervalMs?: number;
  maxBackoffMs?: number;
  onEvent?: (event: TelemetryStreamEvent) => void;
}

export function useTelemetryStream(options: UseTelemetryStreamOptions = {}) {
  const {
    enabled = true,
    wsUrl,
    sseUrl = '/api/v1/stream/telemetry',
    heartbeatIntervalMs = 15000,
    maxBackoffMs = 30000,
    onEvent,
  } = options;

  const [snapshot, setSnapshot] = useState<TelemetryStreamSnapshot>({
    status: enabled ? 'connecting' : 'offline',
    transport: 'websocket',
    reconnectAttempt: 0,
    lastHeartbeatRttMs: null,
    eventsReceived: 0,
    latestTick: null,
    recentEvents: [],
  });

  const [pendingActions, setPendingActions] = useState<OptimisticActionRecord[]>([]);
  const [optimisticFeedback, setOptimisticFeedback] = useState<string | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    setSnapshot((prev) => ({
      ...prev,
      status: 'reconnecting',
      reconnectAttempt: 0,
    }));
    setReconnectNonce((n) => n + 1);
  }, []);

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // RequestAnimationFrame batched queue prevents high-frequency WS floods from freezing UI
  const queuedEventsRef = useRef<TelemetryStreamEvent[]>([]);
  const rafScheduledRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const lastPingSentAtRef = useRef<number>(0);
  const lastPongAtRef = useRef<number>(0);
  const attemptRef = useRef<number>(0);

  const flushBatch = useCallback(() => {
    rafScheduledRef.current = null;
    const batch = queuedEventsRef.current.splice(0, queuedEventsRef.current.length);
    if (batch.length === 0) return;

    let newestTick: TelemetryStreamSnapshot['latestTick'] | null = null;
    let measuredRtt: number | null = null;

    for (const ev of batch) {
      if (ev.type === 'pong') {
        const now = Date.now();
        lastPongAtRef.current = now;
        if (lastPingSentAtRef.current > 0) {
          measuredRtt = Math.max(1, now - lastPingSentAtRef.current);
        }
      } else if (ev.type === 'telemetry_tick' && ev.payload && typeof ev.payload === 'object') {
        const p = ev.payload as Record<string, unknown>;
        newestTick = {
          processedLogs: Number(p.processedLogs || 0),
          traceId: String(p.traceId || 'trace-live'),
          throughputEstimateRps: Number(p.throughputEstimateRps || 0),
          timestamp: ev.timestamp || Date.now(),
        };
      }
      onEventRef.current?.(ev);
    }

    setSnapshot((prev) => ({
      ...prev,
      status: 'connected',
      lastHeartbeatRttMs: measuredRtt ?? prev.lastHeartbeatRttMs,
      eventsReceived: prev.eventsReceived + batch.length,
      latestTick: newestTick ?? prev.latestTick,
      recentEvents: [...batch.reverse(), ...prev.recentEvents].slice(0, 25),
    }));
  }, []);

  const enqueueEvent = useCallback(
    (event: TelemetryStreamEvent) => {
      queuedEventsRef.current.push(event);
      if (rafScheduledRef.current === null) {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          rafScheduledRef.current = window.requestAnimationFrame(flushBatch);
        } else {
          rafScheduledRef.current = setTimeout(flushBatch, 16) as unknown as number;
        }
      }
    },
    [flushBatch]
  );

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    let unmounted = false;

    const clearTimers = () => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatTimerRef.current !== null) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const scheduleReconnect = (connectFn: () => void) => {
      if (unmounted) return;
      attemptRef.current += 1;
      const base = Math.min(maxBackoffMs, 800 * Math.pow(2, Math.min(attemptRef.current - 1, 5)));
      const jitter = Math.floor(Math.random() * 400);
      const delayMs = base + jitter;

      setSnapshot((prev) => ({
        ...prev,
        status: 'reconnecting',
        reconnectAttempt: attemptRef.current,
      }));

      reconnectTimerRef.current = window.setTimeout(() => {
        if (!unmounted) connectFn();
      }, delayMs);
    };

    const startSseFallback = () => {
      if (unmounted || typeof EventSource === 'undefined') {
        setSnapshot((prev) => ({ ...prev, status: 'degraded', transport: 'polling' }));
        return;
      }

      try {
        const es = new EventSource(sseUrl, { withCredentials: true });
        sseRef.current = es;

        es.onopen = () => {
          if (unmounted) return;
          attemptRef.current = 0;
          setSnapshot((prev) => ({
            ...prev,
            status: 'connected',
            transport: 'sse',
            reconnectAttempt: 0,
          }));
        };

        const handleSseMessage = (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data) as TelemetryStreamEvent;
            enqueueEvent(parsed);
          } catch {
            // Ignore unparseable SSE frame
          }
        };

        es.addEventListener('handshake_ack', handleSseMessage);
        es.addEventListener('telemetry_tick', handleSseMessage);
        es.addEventListener('akasha_converged', handleSseMessage);
        es.addEventListener('trace_anomaly_detected', handleSseMessage);
        es.addEventListener('incident_updated', handleSseMessage);
        es.addEventListener('pong', handleSseMessage);

        es.onerror = () => {
          es.close();
          sseRef.current = null;
          if (!unmounted) {
            scheduleReconnect(connectTransport);
          }
        };
      } catch {
        setSnapshot((prev) => ({ ...prev, status: 'degraded', transport: 'polling' }));
      }
    };

    const connectTransport = () => {
      if (unmounted) return;
      clearTimers();

      if (typeof WebSocket === 'undefined') {
        startSseFallback();
        return;
      }

      const resolvedWsUrl =
        wsUrl ||
        `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/telemetry`;

      try {
        const ws = new WebSocket(resolvedWsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
          attemptRef.current = 0;
          lastPongAtRef.current = Date.now();
          setSnapshot((prev) => ({
            ...prev,
            status: 'connected',
            transport: 'websocket',
            reconnectAttempt: 0,
          }));

          heartbeatTimerRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              const now = Date.now();
              if (
                lastPingSentAtRef.current > lastPongAtRef.current &&
                now - lastPingSentAtRef.current > heartbeatIntervalMs * 1.5
              ) {
                setSnapshot((prev) => ({ ...prev, status: 'degraded' }));
              }
              lastPingSentAtRef.current = now;
              ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
            }
          }, heartbeatIntervalMs);
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(String(event.data)) as TelemetryStreamEvent;
            enqueueEvent(parsed);
          } catch {
            // Ignore malformed socket frames
          }
        };

        ws.onerror = () => {
          // Will transition via onclose
        };

        ws.onclose = () => {
          clearTimers();
          wsRef.current = null;
          if (!unmounted) {
            // Fall back to SSE cleanly if WS handshake fails quickly, otherwise exponential backoff
            if (attemptRef.current === 0 && typeof EventSource !== 'undefined') {
              startSseFallback();
            } else {
              scheduleReconnect(connectTransport);
            }
          }
        };
      } catch {
        startSseFallback();
      }
    };

    connectTransport();

    // Fallback timer: if status remains connecting for > 1500ms, transition to connected (idle/polling)
    const fallbackTimer = window.setTimeout(() => {
      if (!unmounted) {
        setSnapshot((prev) => {
          if (prev.status === 'connecting') {
            return { ...prev, status: 'connected', transport: 'polling' };
          }
          return prev;
        });
      }
    }, 1500);

    const handleSessionExpired = () => {
      unmounted = true;
      clearTimeout(fallbackTimer);
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      setSnapshot((prev) => ({ ...prev, status: 'offline', reconnectAttempt: 0 }));
    };

    window.addEventListener('neon-chasm-session-expired', handleSessionExpired);

    return () => {
      unmounted = true;
      window.removeEventListener('neon-chasm-session-expired', handleSessionExpired);
      clearTimeout(fallbackTimer);
      clearTimers();
      if (rafScheduledRef.current !== null) {
        if (typeof window.cancelAnimationFrame === 'function') {
          window.cancelAnimationFrame(rafScheduledRef.current);
        } else {
          clearTimeout(rafScheduledRef.current);
        }
        rafScheduledRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [enabled, wsUrl, sseUrl, heartbeatIntervalMs, maxBackoffMs, enqueueEvent, reconnectNonce]);

  const dispatchOptimisticAction = useCallback(
    async <T,>(params: {
      id?: string;
      label: string;
      applyOptimistic?: () => void;
      execute: () => Promise<T>;
      rollback?: (err: unknown) => void;
    }): Promise<T> => {
      const actionId = params.id || `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setPendingActions((prev) => [
        { id: actionId, label: params.label, status: 'optimistic', startedAt: Date.now() },
        ...prev.slice(0, 9),
      ]);
      setOptimisticFeedback(`Applying ${params.label}...`);
      params.applyOptimistic?.();

      try {
        const result = await params.execute();
        setPendingActions((prev) =>
          prev.map((a) => (a.id === actionId ? { ...a, status: 'committed' } : a))
        );
        setOptimisticFeedback(`${params.label} synchronized.`);
        return result;
      } catch (err) {
        params.rollback?.(err);
        setPendingActions((prev) =>
          prev.map((a) => (a.id === actionId ? { ...a, status: 'rolled_back' } : a))
        );
        setOptimisticFeedback(`${params.label} rolled back cleanly.`);
        throw err;
      }
    },
    []
  );

  return {
    ...snapshot,
    pendingActions,
    optimisticFeedback,
    clearOptimisticFeedback: () => setOptimisticFeedback(null),
    reconnect,
    dispatchOptimisticAction,
  };
}
