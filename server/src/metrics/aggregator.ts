import { metricsQueryCache } from './cache';

export interface PromQLQueryRequest {
  query: string;
  metric?: string;
  aggregation?: 'rate' | 'sum_by' | 'p95' | 'p99' | 'count_over_time' | 'avg';
  window?: string;
  groupBy?: string;
  step?: string;
  threshold?: {
    operator: '>' | '<' | '=';
    warning?: number;
    critical?: number;
  };
}

export interface DataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface MetricQueryResult {
  query: string;
  metric: string;
  aggregation: string;
  cached: boolean;
  executionTimeMs: number;
  dataPoints: DataPoint[];
  currentValue: number;
  status: 'ok' | 'warning' | 'critical';
  thresholdAlert?: {
    level: 'warning' | 'critical';
    message: string;
  };
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

// Parses raw PromQL strings like "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))"
export function parsePromQLExpression(rawQuery: string) {
  let metric = 'http_requests_total';
  let aggregation = 'rate';
  let window = '5m';
  let groupBy = '';

  if (rawQuery.includes('p99') || rawQuery.includes('0.99')) {
    aggregation = 'p99';
  } else if (rawQuery.includes('p95') || rawQuery.includes('0.95')) {
    aggregation = 'p95';
  } else if (rawQuery.includes('sum') || rawQuery.includes('sum_by')) {
    aggregation = 'sum_by';
  } else if (rawQuery.includes('count') || rawQuery.includes('count_over_time')) {
    aggregation = 'count_over_time';
  } else if (rawQuery.includes('avg')) {
    aggregation = 'avg';
  } else if (rawQuery.includes('rate')) {
    aggregation = 'rate';
  }

  if (rawQuery.includes('http_requests_total') || rawQuery.includes('http_requests')) {
    metric = 'http_requests_total';
  } else if (rawQuery.includes('db_query_duration_ms') || rawQuery.includes('db_latency')) {
    metric = 'db_query_duration_ms';
  } else if (rawQuery.includes('cpu_utilization') || rawQuery.includes('cpu')) {
    metric = 'cpu_utilization';
  } else if (rawQuery.includes('error_rate') || rawQuery.includes('5xx')) {
    metric = 'error_rate';
  } else if (rawQuery.includes('memory_rss_bytes') || rawQuery.includes('memory')) {
    metric = 'memory_rss_bytes';
  } else if (rawQuery.includes('rum_cls') || rawQuery.includes('cls')) {
    metric = 'rum_cls';
  }

  const windowMatch = rawQuery.match(/\[(\d+[mhs])\]/);
  if (windowMatch) {
    window = windowMatch[1];
  }

  const byMatch = rawQuery.match(/by\s*\(([^)]+)\)/);
  if (byMatch) {
    groupBy = byMatch[1].trim();
  }

  return { metric, aggregation, window, groupBy };
}

export function evaluateMetricQuery(req: PromQLQueryRequest): MetricQueryResult {
  const startTime = Date.now();
  const cacheKey = JSON.stringify(req);

  const cached = metricsQueryCache.get<MetricQueryResult>(cacheKey);
  if (cached.cached && cached.value) {
    return {
      ...cached.value,
      cached: true,
      executionTimeMs: Math.max(1, Date.now() - startTime),
      cacheStats: metricsQueryCache.getStats(),
    };
  }

  const rawQuery = req.query || '';
  const parsed = parsePromQLExpression(rawQuery);

  const metric = req.metric || parsed.metric;
  const aggregation = req.aggregation || parsed.aggregation;

  // Generate synthetic time-series points based on metric type & aggregation
  const now = Date.now();
  const pointsCount = 24;
  const intervalMs = 60000; // 1 min interval
  const dataPoints: DataPoint[] = [];

  let baseVal = 45;
  let jitter = 10;

  if (metric === 'http_requests_total') {
    baseVal = aggregation === 'rate' ? 320 : 1800;
    jitter = 50;
  } else if (metric === 'db_query_duration_ms') {
    baseVal = aggregation === 'p99' ? 140 : aggregation === 'p95' ? 85 : 35;
    jitter = 25;
  } else if (metric === 'cpu_utilization') {
    baseVal = 62;
    jitter = 12;
  } else if (metric === 'error_rate') {
    baseVal = 1.4;
    jitter = 1.1;
  } else if (metric === 'memory_rss_bytes') {
    baseVal = 480;
    jitter = 30;
  } else if (metric === 'rum_cls') {
    baseVal = 0.04;
    jitter = 0.02;
  }

  for (let i = pointsCount - 1; i >= 0; i--) {
    const timestamp = now - i * intervalMs;
    // Add sinusoidal wave + deterministic jitter
    const wave = Math.sin((i / pointsCount) * Math.PI * 2) * (jitter / 2);
    const pseudoRandom = Math.sin(i * 1337 + timestamp % 997) * (jitter / 2);
    let val = Math.max(0, parseFloat((baseVal + wave + pseudoRandom).toFixed(2)));
    dataPoints.push({ timestamp, value: val });
  }

  const currentValue = dataPoints[dataPoints.length - 1]?.value ?? baseVal;

  // Evaluate threshold alerts
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  let thresholdAlert: { level: 'warning' | 'critical'; message: string } | undefined;

  if (req.threshold) {
    const { operator, warning, critical } = req.threshold;
    if (critical !== undefined) {
      const isCrit = operator === '>' ? currentValue > critical : operator === '<' ? currentValue < critical : currentValue === critical;
      if (isCrit) {
        status = 'critical';
        thresholdAlert = {
          level: 'critical',
          message: `Metric ${metric} (${currentValue}) breached critical threshold (${operator} ${critical})`,
        };
      }
    }
    if (status === 'ok' && warning !== undefined) {
      const isWarn = operator === '>' ? currentValue > warning : operator === '<' ? currentValue < warning : currentValue === warning;
      if (isWarn) {
        status = 'warning';
        thresholdAlert = {
          level: 'warning',
          message: `Metric ${metric} (${currentValue}) breached warning threshold (${operator} ${warning})`,
        };
      }
    }
  }

  const executionTimeMs = Math.max(2, Date.now() - startTime);

  const result: MetricQueryResult = {
    query: rawQuery || `${aggregation}(${metric})`,
    metric,
    aggregation,
    cached: false,
    executionTimeMs,
    dataPoints,
    currentValue,
    status,
    thresholdAlert,
    cacheStats: metricsQueryCache.getStats(),
  };

  // Cache result for 10 seconds
  metricsQueryCache.set(cacheKey, result, 10000);

  return result;
}

export function translateTextToPromQL(promptText: string): { expression: string; metric: string; aggregation: string; explanation: string } {
  const lower = promptText.toLowerCase();

  if (lower.includes('p99') || lower.includes('99th percentile')) {
    return {
      expression: 'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
      metric: 'http_requests_total',
      aggregation: 'p99',
      explanation: 'Calculates the 99th percentile latency across HTTP endpoints using histogram buckets.',
    };
  }
  if (lower.includes('p95') || lower.includes('95th percentile')) {
    return {
      expression: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
      metric: 'http_requests_total',
      aggregation: 'p95',
      explanation: 'Calculates the 95th percentile latency window over 5 minutes.',
    };
  }
  if (lower.includes('error') || lower.includes('5xx') || lower.includes('fail')) {
    return {
      expression: 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
      metric: 'error_rate',
      aggregation: 'rate',
      explanation: 'Ratios 5xx status responses against total incoming throughput as a percentage.',
    };
  }
  if (lower.includes('database') || lower.includes('db') || lower.includes('sql') || lower.includes('postgres')) {
    return {
      expression: 'avg_over_time(db_query_duration_ms[5m])',
      metric: 'db_query_duration_ms',
      aggregation: 'avg',
      explanation: 'Tracks average database query duration over a rolling 5-minute window.',
    };
  }
  if (lower.includes('cpu') || lower.includes('utilization') || lower.includes('processor')) {
    return {
      expression: '100 - (avg_over_time(node_cpu_seconds_total{mode="idle"}[5m]) * 100)',
      metric: 'cpu_utilization',
      aggregation: 'avg',
      explanation: 'Calculates non-idle CPU usage across worker nodes.',
    };
  }

  return {
    expression: 'sum(rate(http_requests_total[5m])) by (endpoint)',
    metric: 'http_requests_total',
    aggregation: 'rate',
    explanation: 'Aggregates overall request throughput grouped by endpoint path.',
  };
}
