export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface CoreWebVitals {
  lcp?: number;
  fid?: number;
  cls?: number;
  inp?: number;
}

export interface ApiRequestLog {
  id: string;
  timestamp: number;
  method: HttpMethod;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  clientIp: string;
  userAgent: string;
  traceId: string;
  spanId: string;
  parentId?: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: unknown;
  responseBody: unknown;
  webVitals?: CoreWebVitals;
  errorDetails?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface FilterState {
  searchText: string;
  methods: HttpMethod[];
  statusCodeRange: [number, number];
  latencyThreshold: [number, number];
  traceId: string;
  timeWindow: [number, number];
}

export interface AggregatedMetrics {
  totalRequests: number;
  errorCount: number;
  successRate: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  activeAnomaliesCount: number;
}

export interface MetricDeltas {
  totalRequestsDelta: number; // percentage change vs previous window, e.g. +12.4
  errorRateDelta: number;
  avgLatencyDelta: number;
  p95LatencyDelta: number;
}

export interface TimeBucket {
  timestamp: number;
  requestCount: number;
  errorCount: number;
  avgLatency: number;
  p95Latency: number;
}

export interface AnomalyRule {
  id: string;
  name: string;
  metric: 'latency' | 'error_rate' | 'status_5xx';
  threshold: number;
  windowMinutes: number;
  severity: 'warning' | 'critical';
  enabled: boolean;
}

export interface DetectedAnomaly {
  ruleId: string;
  ruleName: string;
  metric: 'latency' | 'error_rate' | 'status_5xx';
  severity: 'warning' | 'critical';
  currentValue: number;
  threshold: number;
  detectedAt: number;
  description: string;
}

export type TimeRangePreset = '15m' | '1h' | '24h' | '7d';
export type TimezoneMode = 'local' | 'utc' | 'relative';
export type DensityMode = 'comfortable' | 'compact';
export type DashboardView = 'dashboard' | 'logs' | 'analytics' | 'anomalies' | 'settings';
