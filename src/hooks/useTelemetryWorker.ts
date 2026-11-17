'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WorkerAction, WorkerResponse } from '../types/workerMessages';
import {
  ApiRequestLog,
  FilterState,
  AggregatedMetrics,
  MetricDeltas,
  TimeBucket,
  AnomalyRule,
  DetectedAnomaly,
} from '../types/telemetry';
import {
  computeAggregatedMetrics,
  computeDeltas,
  aggregateTimeBuckets,
  evaluateFilterIndices,
  evaluateAnomalyRules,
} from '../utils/metrics';

interface UseTelemetryWorkerReturn {
  status: 'idle' | 'loading' | 'ready' | 'error';
  isIngesting: boolean;
  totalLogsCount: number;
  filteredLogsCount: number;
  throughput: number;
  activeMetrics: AggregatedMetrics | null;
  deltas: MetricDeltas | null;
  timeBuckets: TimeBucket[];
  anomalies: DetectedAnomaly[];
  ingestLogsInChunks: (logs: ApiRequestLog[], chunkSize?: number) => Promise<void>;
  applyFilters: (filters: Partial<FilterState>) => Promise<number>;
  refreshMetrics: () => Promise<AggregatedMetrics>;
  computeBuckets: (bucketSizeMinutes?: number) => Promise<TimeBucket[]>;
  evaluateAnomalies: (rules: AnomalyRule[]) => Promise<DetectedAnomaly[]>;
  getFilteredLogs: (limit?: number) => ApiRequestLog[];
  resetAll: () => void;
}

const EMPTY_METRICS: AggregatedMetrics = {
  totalRequests: 0,
  errorCount: 0,
  successRate: 100,
  avgLatency: 0,
  p50Latency: 0,
  p95Latency: 0,
  p99Latency: 0,
  activeAnomaliesCount: 0,
};

const EMPTY_DELTAS: MetricDeltas = {
  totalRequestsDelta: 0,
  errorRateDelta: 0,
  avgLatencyDelta: 0,
  p95LatencyDelta: 0,
};

export function useTelemetryWorker(): UseTelemetryWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const isWorkerReadyRef = useRef<boolean>(false);
  const [status] = useState<'idle' | 'loading' | 'ready' | 'error'>('ready');
  const [isIngesting, setIsIngesting] = useState(false);
  const [totalLogsCount, setTotalLogsCount] = useState(0);
  const [filteredLogsCount, setFilteredLogsCount] = useState(0);
  const [throughput, setThroughput] = useState(0);

  const [activeMetrics, setActiveMetrics] = useState<AggregatedMetrics | null>(EMPTY_METRICS);
  const [deltas, setDeltas] = useState<MetricDeltas | null>(EMPTY_DELTAS);
  const [timeBuckets, setTimeBuckets] = useState<TimeBucket[]>([]);
  const [anomalies, setAnomalies] = useState<DetectedAnomaly[]>([]);

  // Main thread fallback storage in case worker is unavailable (e.g. strict browser CSP/SSR)
  const mainThreadLogs = useRef<ApiRequestLog[]>([]);
  const mainThreadFilteredIndices = useRef<Uint32Array>(new Uint32Array(0));

  // Request correlation tokens to discard stale out-of-order responses
  const activeRequests = useRef(new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>());
  const requestIdCounter = useRef(0);

  const getNextRequestId = useCallback(() => {
    requestIdCounter.current += 1;
    return `req_${Date.now()}_${requestIdCounter.current}`;
  }, []);

  // Ingest logs in chunks (safe for empty 0-record telemetry slices)
  const ingestLogsInChunks = useCallback(
    async (logs: ApiRequestLog[], chunkSize: number = 5000): Promise<void> => {
      const total = logs.length;

      // Always update main thread reference for fast direct querying/fallback
      mainThreadLogs.current = logs;
      const allIndices = new Uint32Array(total);
      for (let i = 0; i < total; i++) allIndices[i] = i;
      mainThreadFilteredIndices.current = allIndices;

      if (total === 0) {
        setTotalLogsCount(0);
        setFilteredLogsCount(0);
        setThroughput(0);
        setActiveMetrics(EMPTY_METRICS);
        setDeltas(EMPTY_DELTAS);
        setTimeBuckets([]);
        setAnomalies([]);
        setIsIngesting(false);
        if (workerRef.current && isWorkerReadyRef.current) {
          workerRef.current.postMessage({ type: 'RESET_LOGS' } satisfies WorkerAction);
        }
        return;
      }

      setIsIngesting(true);

      if (workerRef.current && isWorkerReadyRef.current) {
        for (let i = 0; i < total; i += chunkSize) {
          const chunk = logs.slice(i, i + chunkSize);
          const isFinal = i + chunkSize >= total;
          const action: WorkerAction = {
            type: 'INGEST_CHUNK',
            payload: {
              chunk,
              isFinal,
              totalExpected: total,
              replaceExisting: i === 0,
            },
          };
          workerRef.current.postMessage(action);
          // Yield to event loop to keep UI thread fluid
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } else {
        // Fallback: synchronous batching on main thread
        setTotalLogsCount(total);
        setFilteredLogsCount(total);
        const m = computeAggregatedMetrics(logs);
        setActiveMetrics(m);
        setIsIngesting(false);
      }
    },
    []
  );

  // Apply filters
  const applyFilters = useCallback(
    async (filters: Partial<FilterState>): Promise<number> => {
      const reqId = getNextRequestId();

      if (workerRef.current && isWorkerReadyRef.current) {
        return new Promise<number>((resolve, reject) => {
          activeRequests.current.set(reqId, { resolve, reject });
          const action: WorkerAction = {
            type: 'APPLY_FILTERS',
            payload: { filters, requestId: reqId },
          };
          workerRef.current?.postMessage(action);
        });
      }

      // Main thread fallback
      const indices = evaluateFilterIndices(mainThreadLogs.current, filters);
      mainThreadFilteredIndices.current = indices;
      setFilteredLogsCount(indices.length);

      const subset: ApiRequestLog[] = [];
      for (let i = 0; i < indices.length; i++) {
        subset.push(mainThreadLogs.current[indices[i]]);
      }
      setActiveMetrics(computeAggregatedMetrics(subset));
      return indices.length;
    },
    [getNextRequestId]
  );

  // Refresh metrics
  const refreshMetrics = useCallback(async (): Promise<AggregatedMetrics> => {
    const reqId = getNextRequestId();

    if (workerRef.current && isWorkerReadyRef.current) {
      return new Promise<AggregatedMetrics>((resolve, reject) => {
        activeRequests.current.set(reqId, { resolve, reject });
        const action: WorkerAction = {
          type: 'CALCULATE_METRICS',
          payload: { requestId: reqId },
        };
        workerRef.current?.postMessage(action);
      });
    }

    // Main thread fallback
    const subset: ApiRequestLog[] = [];
    const idxs = mainThreadFilteredIndices.current;
    for (let i = 0; i < idxs.length; i++) {
      subset.push(mainThreadLogs.current[idxs[i]]);
    }
    const metrics = computeAggregatedMetrics(subset);
    setActiveMetrics(metrics);
    return metrics;
  }, [getNextRequestId]);

  // Compute time buckets
  const computeBuckets = useCallback(
    async (bucketSizeMinutes: number = 1): Promise<TimeBucket[]> => {
      const reqId = getNextRequestId();

      if (workerRef.current && isWorkerReadyRef.current) {
        return new Promise<TimeBucket[]>((resolve, reject) => {
          activeRequests.current.set(reqId, { resolve, reject });
          const action: WorkerAction = {
            type: 'COMPUTE_TIME_BUCKETS',
            payload: { requestId: reqId, bucketSizeMinutes },
          };
          workerRef.current?.postMessage(action);
        });
      }

      // Main thread fallback
      const subset: ApiRequestLog[] = [];
      const idxs = mainThreadFilteredIndices.current;
      for (let i = 0; i < idxs.length; i++) {
        subset.push(mainThreadLogs.current[idxs[i]]);
      }
      const buckets = aggregateTimeBuckets(subset, bucketSizeMinutes);
      setTimeBuckets(buckets);
      return buckets;
    },
    [getNextRequestId]
  );

  // Evaluate anomalies
  const evaluateAnomalies = useCallback(
    async (rules: AnomalyRule[]): Promise<DetectedAnomaly[]> => {
      const reqId = getNextRequestId();

      if (workerRef.current && isWorkerReadyRef.current) {
        return new Promise<DetectedAnomaly[]>((resolve, reject) => {
          activeRequests.current.set(reqId, { resolve, reject });
          const action: WorkerAction = {
            type: 'EVALUATE_ANOMALIES',
            payload: { rules, requestId: reqId },
          };
          workerRef.current?.postMessage(action);
        });
      }

      // Main thread fallback
      const detected = evaluateAnomalyRules(mainThreadLogs.current, rules);
      setAnomalies(detected);
      return detected;
    },
    [getNextRequestId]
  );

  // Retrieve slice of filtered logs for virtualized views or table
  const getFilteredLogs = useCallback((limit: number = 50): ApiRequestLog[] => {
    const idxs = mainThreadFilteredIndices.current;
    const len = Math.min(idxs.length, limit);
    const result: ApiRequestLog[] = [];
    for (let i = 0; i < len; i++) {
      const log = mainThreadLogs.current[idxs[i]];
      if (log) result.push(log);
    }
    return result;
  }, []);

  const resetAll = useCallback(() => {
    mainThreadLogs.current = [];
    mainThreadFilteredIndices.current = new Uint32Array(0);
    setTotalLogsCount(0);
    setFilteredLogsCount(0);
    setThroughput(0);
    setActiveMetrics(EMPTY_METRICS);
    setDeltas(EMPTY_DELTAS);
    setTimeBuckets([]);
    setAnomalies([]);
    setIsIngesting(false);
    if (workerRef.current && isWorkerReadyRef.current) {
      workerRef.current.postMessage({ type: 'RESET_LOGS' } satisfies WorkerAction);
    }
  }, []);

  return {
    status,
    isIngesting,
    totalLogsCount,
    filteredLogsCount,
    throughput,
    activeMetrics,
    deltas,
    timeBuckets,
    anomalies,
    ingestLogsInChunks,
    applyFilters,
    refreshMetrics,
    computeBuckets,
    evaluateAnomalies,
    getFilteredLogs,
    resetAll,
  };
}
