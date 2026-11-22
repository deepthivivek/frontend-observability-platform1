'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Infinity as InfinityIcon,
} from 'lucide-react';

interface LivenessPayload {
  status: string;
  requestId?: string;
  uptimeSeconds: number;
  pid: number;
  nodeVersion: string;
  timestamp: number;
}

interface PlatformTelemetryPayload {
  activeSseSubscribers: number;
  totalTenants: number;
  totalUsers: number;
  totalBufferedRecords: number;
  estimatedBufferBytes: number;
  authChecksTotal: number;
  authChecksDenied: number;
  totalIngestBatches: number;
  totalIngestedRecords: number;
  redactedSecretsTotal?: number;
  ingestionEventsPerSec: number;
  uptimeSeconds: number;
}

interface ReadinessPayload {
  status: string;
  requestId?: string;
  reason?: string;
  uptimeSeconds: number;
  freeMemoryPct: number;
  platformTelemetry?: PlatformTelemetryPayload;
  components?: {
    otlpIngestion?: {
      status: string;
      batchesIngested: number;
      recordsIngested: number;
      totalIngestedRecords?: number;
      ingestionEventsPerSec?: number;
      lastIngestedAt: number | null;
      connectedStreamSubscribers: number;
    };
    statePersistence?: {
      status: string;
      directory: string;
      writable: boolean;
      akashaChecksumValid: boolean;
      auditChecksumValid: boolean;
    };
    akashaConvergence?: {
      status: string;
      cycleEpoch: number;
      globalCoherenceIndex: number;
      convergedEngines: number;
      eternalStateHash: string;
    };
  };
  subsystems?: Record<string, string>;
  timestamp: number;
}

export const HealthDashboard: React.FC = () => {
  const [liveness, setLiveness] = useState<LivenessPayload | null>(null);
  const [readiness, setReadiness] = useState<ReadinessPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchProbes = useCallback(async () => {
    try {
      const [healthRes, readyRes] = await Promise.all([
        fetch('/healthz', { cache: 'no-store' }),
        fetch('/readyz', { cache: 'no-store' }),
      ]);

      if (!healthRes.ok && healthRes.status >= 500) {
        throw new Error(`Liveness probe returned HTTP ${healthRes.status}`);
      }

      const healthData = (await healthRes.json()) as LivenessPayload;
      const readyData = (await readyRes.json()) as ReadinessPayload;
      setLiveness(healthData);
      setReadiness(readyData);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to reach /healthz or /readyz');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void fetchProbes();
    }, 0);
    const interval = window.setInterval(() => {
      void fetchProbes();
    }, 15000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [fetchProbes]);

  const isHealthy = liveness?.status === 'healthy' && readiness?.status === 'READY';
  const otlp = readiness?.components?.otlpIngestion;
  const persistence = readiness?.components?.statePersistence;
  const akasha = readiness?.components?.akashaConvergence;
  const selfTelemetry = readiness?.platformTelemetry;

  return (
    <section
      aria-label="System Health and Readiness"
      className="glass-card chromatic-rim rounded-2xl p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-subtleBorder pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border ${
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            <Server className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-customText">
              System Health, Readiness &amp; Platform Self-Telemetry
            </h2>
            <p className="text-xs text-mutedText font-mono tabular-nums">
              {isLoading
                ? 'Polling /healthz and /readyz...'
                : liveness
                ? `PID ${liveness.pid} · Uptime ${liveness.uptimeSeconds}s · Free RAM ${readiness?.freeMemoryPct ?? '--'}%`
                : 'Probe telemetry unavailable'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold whitespace-nowrap shrink-0 ${
              isHealthy
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {isHealthy ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {readiness?.status || (isLoading ? 'Checking' : 'Degraded')}
          </span>

          <button
            type="button"
            onClick={() => void fetchProbes()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-elevated hover:bg-surface text-customText border border-subtleBorder transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Probes</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300 font-mono">
          Probe check error: {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-subtleBorder bg-surface/80 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-mutedText">
            <span className="font-medium text-customText flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              OTLP Ingestion Pipeline
            </span>
            <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              {otlp?.status || 'UNKNOWN'}
            </span>
          </div>
          <div className="text-lg font-semibold font-mono tabular-nums text-customText">
            {(otlp?.recordsIngested ?? 0).toLocaleString()} buffered
          </div>
          <p className="text-[11px] font-mono tabular-nums text-mutedText">
            Batches: {otlp?.batchesIngested ?? 0} · Rate: {selfTelemetry?.ingestionEventsPerSec ?? 0} EPS · SSE: {otlp?.connectedStreamSubscribers ?? 0} · Redacted: {selfTelemetry?.redactedSecretsTotal ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-subtleBorder bg-surface/80 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-mutedText">
            <span className="font-medium text-customText flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
              Engine Buffer &amp; WAL Storage
            </span>
            <span
              className={`font-mono font-semibold ${
                persistence?.writable
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {persistence?.status || 'UNKNOWN'}
            </span>
          </div>
          <div className="text-lg font-semibold font-mono tabular-nums text-customText">
            {((selfTelemetry?.estimatedBufferBytes ?? 0) / 1024).toFixed(1)} KB
          </div>
          <p className="text-[11px] font-mono text-mutedText truncate" title={persistence?.directory}>
            Tenants: {selfTelemetry?.totalTenants ?? 0} · Auth Denials: {selfTelemetry?.authChecksDenied ?? 0}/{selfTelemetry?.authChecksTotal ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-subtleBorder bg-surface/80 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-mutedText">
            <span className="font-medium text-customText flex items-center gap-1.5">
              <InfinityIcon className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              Akasha Convergence
            </span>
            <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
              {akasha?.status || 'UNKNOWN'}
            </span>
          </div>
          <div className="text-lg font-semibold font-mono tabular-nums text-customText">
            Epoch #{akasha?.cycleEpoch ?? '--'}
          </div>
          <p className="text-[11px] font-mono tabular-nums text-mutedText truncate">
            Coherence: {akasha ? `${(akasha.globalCoherenceIndex * 100).toFixed(2)}%` : '--'} · Engines: {akasha?.convergedEngines ?? 0}/16
          </p>
        </div>
      </div>
    </section>
  );
};
