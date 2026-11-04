import {
  AggregatedMetrics,
  ApiRequestLog,
  FilterState,
  MetricDeltas,
  TimeBucket,
  AnomalyRule,
  DetectedAnomaly
} from '../types/telemetry';

/**
 * Calculates a specific percentile from a pre-sorted array of latencies.
 * Supports exact linear interpolation between rank positions.
 */
export function calculatePercentile(sortedLatencies: number[], percentile: number): number {
  if (!sortedLatencies || sortedLatencies.length === 0) return 0;
  if (percentile <= 0) return sortedLatencies[0];
  if (percentile >= 100) return sortedLatencies[sortedLatencies.length - 1];

  const index = (percentile / 100) * (sortedLatencies.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sortedLatencies.length) return sortedLatencies[lower];
  
  const result = sortedLatencies[lower] * (1 - weight) + sortedLatencies[upper] * weight;
  return Number(result.toFixed(2));
}

/**
 * Calculates standard Z-score for outlier detection.
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0 || isNaN(stdDev) || !isFinite(stdDev)) return 0;
  const z = (value - mean) / stdDev;
  return Number(z.toFixed(3));
}

/**
 * Computes mean and sample standard deviation of an array.
 */
export function calculateMeanAndStdDev(values: number[]): { mean: number; stdDev: number } {
  if (!values || values.length === 0) return { mean: 0, stdDev: 0 };
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / values.length;
  if (values.length === 1) return { mean, stdDev: 0 };

  const varianceSum = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  const stdDev = Math.sqrt(varianceSum / (values.length - 1));
  return { mean, stdDev };
}

/**
 * Calculates aggregated metrics from a subset of logs.
 */
export function computeAggregatedMetrics(
  logs: ApiRequestLog[],
  activeAnomaliesCount: number = 0
): AggregatedMetrics {
  const totalRequests = logs.length;
  if (totalRequests === 0) {
    return {
      totalRequests: 0,
      errorCount: 0,
      successRate: 100,
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      activeAnomaliesCount: 0,
    };
  }

  let errorCount = 0;
  let totalLatency = 0;
  const latencies: number[] = new Array(totalRequests);

  for (let i = 0; i < totalRequests; i++) {
    const log = logs[i];
    const lat = typeof log.latencyMs === 'number' && !isNaN(log.latencyMs) ? log.latencyMs : 0;
    latencies[i] = lat;
    totalLatency += lat;

    if (log.statusCode >= 400) {
      errorCount++;
    }
  }

  // Sort latencies in ascending order for percentiles
  latencies.sort((a, b) => a - b);

  const avgLatency = Number((totalLatency / totalRequests).toFixed(2));
  const successRate = Number((((totalRequests - errorCount) / totalRequests) * 100).toFixed(2));
  const p50Latency = calculatePercentile(latencies, 50);
  const p95Latency = calculatePercentile(latencies, 95);
  const p99Latency = calculatePercentile(latencies, 99);

  return {
    totalRequests,
    errorCount,
    successRate,
    avgLatency,
    p50Latency,
    p95Latency,
    p99Latency,
    activeAnomaliesCount,
  };
}

/**
 * Computes comparative deltas between current period metrics and prior period metrics.
 */
export function computeDeltas(
  current: AggregatedMetrics,
  previous?: AggregatedMetrics | null
): MetricDeltas {
  if (!previous || previous.totalRequests === 0) {
    return {
      totalRequestsDelta: 0,
      errorRateDelta: 0,
      avgLatencyDelta: 0,
      p95LatencyDelta: 0,
    };
  }

  const calcPercentageDelta = (curr: number, prev: number) => {
    if (prev === 0) return curr === 0 ? 0 : 100;
    return Number((((curr - prev) / prev) * 100).toFixed(1));
  };

  const currErrorRate = (current.errorCount / (current.totalRequests || 1)) * 100;
  const prevErrorRate = (previous.errorCount / (previous.totalRequests || 1)) * 100;

  return {
    totalRequestsDelta: calcPercentageDelta(current.totalRequests, previous.totalRequests),
    errorRateDelta: Number((currErrorRate - prevErrorRate).toFixed(1)),
    avgLatencyDelta: calcPercentageDelta(current.avgLatency, previous.avgLatency),
    p95LatencyDelta: calcPercentageDelta(current.p95Latency, previous.p95Latency),
  };
}

/**
 * Partitions logs into equal time-series buckets (e.g. 1-minute intervals).
 */
export function aggregateTimeBuckets(
  logs: ApiRequestLog[],
  bucketMinutes: number = 1
): TimeBucket[] {
  if (logs.length === 0) return [];

  const bucketMs = bucketMinutes * 60 * 1000;
  // Map keyed by rounded bucket start timestamp
  const bucketsMap = new Map<number, { count: number; errorCount: number; latencies: number[] }>();

  let minTime = logs[0].timestamp;
  let maxTime = logs[0].timestamp;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const ts = log.timestamp;
    if (ts < minTime) minTime = ts;
    if (ts > maxTime) maxTime = ts;

    const bucketKey = Math.floor(ts / bucketMs) * bucketMs;
    let b = bucketsMap.get(bucketKey);
    if (!b) {
      b = { count: 0, errorCount: 0, latencies: [] };
      bucketsMap.set(bucketKey, b);
    }
    b.count++;
    if (log.statusCode >= 400) b.errorCount++;
    b.latencies.push(log.latencyMs || 0);
  }

  // Generate contiguous buckets between min and max
  const startBucket = Math.floor(minTime / bucketMs) * bucketMs;
  const endBucket = Math.floor(maxTime / bucketMs) * bucketMs;
  const result: TimeBucket[] = [];

  for (let t = startBucket; t <= endBucket; t += bucketMs) {
    const data = bucketsMap.get(t);
    if (!data || data.count === 0) {
      result.push({
        timestamp: t,
        requestCount: 0,
        errorCount: 0,
        avgLatency: 0,
        p95Latency: 0,
      });
    } else {
      data.latencies.sort((a, b) => a - b);
      const sum = data.latencies.reduce((acc, v) => acc + v, 0);
      result.push({
        timestamp: t,
        requestCount: data.count,
        errorCount: data.errorCount,
        avgLatency: Number((sum / data.count).toFixed(2)),
        p95Latency: calculatePercentile(data.latencies, 95),
      });
    }
  }

  return result;
}

/**
 * Filter logs using index-based evaluation matching multi-facet criteria.
 */
export function evaluateFilterIndices(
  logs: ApiRequestLog[],
  filters: Partial<FilterState>
): Uint32Array {
  const matches: number[] = [];
  const searchLower = filters.searchText ? filters.searchText.toLowerCase().trim() : null;
  const traceLower = filters.traceId ? filters.traceId.toLowerCase().trim() : null;
  const methodsSet = filters.methods && filters.methods.length > 0 ? new Set(filters.methods) : null;
  const [minStatus, maxStatus] = filters.statusCodeRange || [0, 999];
  const [minLatency, maxLatency] = filters.latencyThreshold || [0, Number.MAX_SAFE_INTEGER];
  const [startTime, endTime] = filters.timeWindow || [0, Number.MAX_SAFE_INTEGER];

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    if (log.timestamp < startTime || log.timestamp > endTime) continue;
    if (log.statusCode < minStatus || log.statusCode > maxStatus) continue;
    if (log.latencyMs < minLatency || log.latencyMs > maxLatency) continue;
    if (methodsSet && !methodsSet.has(log.method)) continue;

    if (traceLower && !log.traceId.toLowerCase().includes(traceLower)) continue;

    if (searchLower) {
      const match =
        log.endpoint.toLowerCase().includes(searchLower) ||
        log.clientIp.toLowerCase().includes(searchLower) ||
        log.userAgent.toLowerCase().includes(searchLower) ||
        (log.errorDetails?.message && log.errorDetails.message.toLowerCase().includes(searchLower));
      if (!match) continue;
    }

    matches.push(i);
  }

  return new Uint32Array(matches);
}

/**
 * Evaluates active anomaly detection rules against rolling window statistics.
 */
export function evaluateAnomalyRules(
  logs: ApiRequestLog[],
  rules: AnomalyRule[]
): DetectedAnomaly[] {
  const detected: DetectedAnomaly[] = [];
  if (!rules || rules.length === 0 || logs.length === 0) return detected;

  const now = Date.now();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const windowMs = (rule.windowMinutes || 5) * 60 * 1000;
    const windowStart = now - windowMs;
    const windowLogs = logs.filter(l => l.timestamp >= windowStart);

    if (windowLogs.length === 0) continue;

    if (rule.metric === 'latency') {
      const latencies = windowLogs.map(l => l.latencyMs).sort((a, b) => a - b);
      const p95 = calculatePercentile(latencies, 95);
      if (p95 > rule.threshold) {
        detected.push({
          ruleId: rule.id,
          ruleName: rule.name,
          metric: 'latency',
          severity: rule.severity,
          currentValue: p95,
          threshold: rule.threshold,
          detectedAt: now,
          description: `p95 Latency (${p95}ms) exceeded threshold of ${rule.threshold}ms in the last ${rule.windowMinutes}m.`,
        });
      }
    } else if (rule.metric === 'error_rate') {
      const errCount = windowLogs.filter(l => l.statusCode >= 400).length;
      const rate = Number(((errCount / windowLogs.length) * 100).toFixed(2));
      if (rate > rule.threshold) {
        detected.push({
          ruleId: rule.id,
          ruleName: rule.name,
          metric: 'error_rate',
          severity: rule.severity,
          currentValue: rate,
          threshold: rule.threshold,
          detectedAt: now,
          description: `Error Rate (${rate}%) exceeded threshold of ${rule.threshold}% in the last ${rule.windowMinutes}m.`,
        });
      }
    } else if (rule.metric === 'status_5xx') {
      const count5xx = windowLogs.filter(l => l.statusCode >= 500).length;
      if (count5xx > rule.threshold) {
        detected.push({
          ruleId: rule.id,
          ruleName: rule.name,
          metric: 'status_5xx',
          severity: rule.severity,
          currentValue: count5xx,
          threshold: rule.threshold,
          detectedAt: now,
          description: `Server 5xx error count (${count5xx}) exceeded threshold of ${rule.threshold} in the last ${rule.windowMinutes}m.`,
        });
      }
    }
  }

  return detected;
}
