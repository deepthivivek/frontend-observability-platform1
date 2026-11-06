export type WidgetType = 'line' | 'heatmap' | 'stat' | 'distribution';

export interface WidgetThreshold {
  operator: '>' | '<' | '=';
  warning?: number;
  critical?: number;
}

export interface PromQLQueryConfig {
  expression: string;
  step: string;
  legendFormat?: string;
  metric?: string;
  aggregation?: 'rate' | 'sum_by' | 'p95' | 'p99' | 'count_over_time' | 'avg';
  window?: string;
  groupBy?: string;
}

export interface MetricWidget {
  id: string;
  title: string;
  type: WidgetType;
  query: PromQLQueryConfig;
  gridSpan: {
    w: number; // grid columns out of 12 (e.g. 4, 6, 12)
    h: number; // height unit (e.g. 1, 2)
  };
  threshold?: WidgetThreshold;
  unit?: string; // e.g. 'ms', '%', 'req/s', 'MB'
  description?: string;
}

export interface DashboardPreset {
  id: string;
  name: string;
  description: string;
  category: 'SRE Core' | 'Microservices' | 'Database' | 'Frontend RUM' | 'Custom';
  widgets: MetricWidget[];
  tags: string[];
  createdAt: number;
}

export interface MetricQueryResultPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface MetricQueryResponse {
  query: string;
  metric: string;
  cached: boolean;
  executionTimeMs: number;
  dataPoints: MetricQueryResultPoint[];
  currentValue: number;
  status: 'ok' | 'warning' | 'critical';
  thresholdAlert?: {
    level: 'warning' | 'critical';
    message: string;
  };
}
