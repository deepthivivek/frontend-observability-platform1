import { WorkerAction, WorkerResponse } from '../types/workerMessages';
import { ApiRequestLog, FilterState, AnomalyRule } from '../types/telemetry';
import {
  computeAggregatedMetrics,
  computeDeltas,
  aggregateTimeBuckets,
  evaluateFilterIndices,
  evaluateAnomalyRules,
} from '../utils/metrics';

// In-worker memory store
let logs: ApiRequestLog[] = [];
let activeFilteredIndices: Uint32Array = new Uint32Array(0);
let lastProcessedTime = Date.now();

// LRU Cache for computed metrics
const metricsCache = new Map<string, any>();
const MAX_CACHE_SIZE = 50;

function setCache(key: string, value: any) {
  if (metricsCache.size >= MAX_CACHE_SIZE) {
    const firstKey = metricsCache.keys().next().value;
    if (firstKey) metricsCache.delete(firstKey);
  }
  metricsCache.set(key, value);
}

// Memory Guard: Clean up cache if memory pressure is triggered
function runMemoryGuard() {
  if (metricsCache.size > 10) {
    metricsCache.clear();
  }
  if (typeof (self as any).gc === 'function') {
    (self as any).gc();
  }
}

self.onmessage = (e: MessageEvent<WorkerAction>) => {
  const action = e.data;
  if (!action || !action.type) return;

  try {
    switch (action.type) {
      case 'INGEST_CHUNK': {
        const { chunk, isFinal } = action.payload;
        const startTime = Date.now();
        if (Array.isArray(chunk)) {
          logs.push(...chunk);
        }
        const elapsed = (Date.now() - startTime) || 1;
        const throughput = Math.round((chunk.length / elapsed) * 1000);

        if (isFinal || logs.length === chunk.length) {
          activeFilteredIndices = new Uint32Array(logs.length);
          for (let i = 0; i < logs.length; i++) {
            activeFilteredIndices[i] = i;
          }
        }

        const response: WorkerResponse = {
          type: 'INGESTION_PROGRESS',
          payload: {
            processedCount: logs.length,
            isComplete: isFinal,
            throughputPerSec: throughput,
          },
        };
        self.postMessage(response);
        break;
      }

      case 'APPLY_FILTERS': {
        const { filters, requestId } = action.payload;
        const filtered = evaluateFilterIndices(logs, filters);
        activeFilteredIndices = filtered;

        const response: WorkerResponse = {
          type: 'FILTERS_APPLIED',
          payload: {
            filteredIndices: filtered,
            matchedCount: filtered.length,
            totalCount: logs.length,
            requestId,
          },
        };
        // Transfer buffer for maximum performance
        (self as unknown as Worker).postMessage(response, [filtered.buffer as ArrayBuffer]);
        break;
      }

      case 'CALCULATE_METRICS': {
        const { requestId } = action.payload;
        const cacheKey = `metrics_${activeFilteredIndices.length}_${logs.length}`;
        if (metricsCache.has(cacheKey)) {
          const cached = metricsCache.get(cacheKey);
          self.postMessage({
            type: 'METRICS_CALCULATED',
            payload: { ...cached, requestId },
          });
          return;
        }

        // Gather logs in active index set
        const activeLogs: ApiRequestLog[] = new Array(activeFilteredIndices.length);
        for (let i = 0; i < activeFilteredIndices.length; i++) {
          activeLogs[i] = logs[activeFilteredIndices[i]];
        }

        const metrics = computeAggregatedMetrics(activeLogs);

        // Previous window comparison (e.g. earlier half of time window)
        let deltas = { totalRequestsDelta: 0, errorRateDelta: 0, avgLatencyDelta: 0, p95LatencyDelta: 0 };
        if (activeLogs.length > 10) {
          const midpoint = Math.floor(activeLogs.length / 2);
          const currentLogs = activeLogs.slice(midpoint);
          const prevLogs = activeLogs.slice(0, midpoint);
          const currentSubMetrics = computeAggregatedMetrics(currentLogs);
          const prevSubMetrics = computeAggregatedMetrics(prevLogs);
          deltas = computeDeltas(currentSubMetrics, prevSubMetrics);
        }

        const payload = { metrics, deltas };
        setCache(cacheKey, payload);

        const response: WorkerResponse = {
          type: 'METRICS_CALCULATED',
          payload: { ...payload, requestId },
        };
        self.postMessage(response);
        break;
      }

      case 'COMPUTE_TIME_BUCKETS': {
        const { requestId, bucketSizeMinutes = 1 } = action.payload;
        const activeLogs: ApiRequestLog[] = new Array(activeFilteredIndices.length);
        for (let i = 0; i < activeFilteredIndices.length; i++) {
          activeLogs[i] = logs[activeFilteredIndices[i]];
        }
        const buckets = aggregateTimeBuckets(activeLogs, bucketSizeMinutes);

        const response: WorkerResponse = {
          type: 'TIME_BUCKETS_COMPUTED',
          payload: { buckets, requestId },
        };
        self.postMessage(response);
        break;
      }

      case 'EVALUATE_ANOMALIES': {
        const { rules, requestId } = action.payload;
        const anomalies = evaluateAnomalyRules(logs, rules);

        const response: WorkerResponse = {
          type: 'ANOMALIES_EVALUATED',
          payload: { anomalies, requestId },
        };
        self.postMessage(response);
        break;
      }

      case 'MEMORY_GUARD': {
        runMemoryGuard();
        const response: WorkerResponse = {
          type: 'MEMORY_STATS',
          payload: {
            approximateLogCount: logs.length,
          },
        };
        self.postMessage(response);
        break;
      }
    }
  } catch (err: any) {
    const errorResponse: WorkerResponse = {
      type: 'ERROR',
      payload: {
        message: err?.message || 'Worker processing failure',
      },
    };
    self.postMessage(errorResponse);
  }
};
