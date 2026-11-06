import { Router, Request, Response } from 'express';

export interface DashboardPresetPayload {
  id: string;
  name: string;
  description: string;
  category: string;
  widgets: any[];
  tags: string[];
  createdAt?: number;
}

const defaultPresets: DashboardPresetPayload[] = [
  {
    id: 'preset-sre-health',
    name: 'SRE Core Health & Edge Gateway',
    description: 'P99 Latencies, 5xx Error Spike Detection, Throughput & Active Anomalies',
    category: 'SRE Core',
    tags: ['sre', 'gateway', 'production'],
    createdAt: 1700000000000,
    widgets: [
      {
        id: 'w-p99-latency',
        title: 'P99 Latency vs Target (ms)',
        type: 'line',
        unit: 'ms',
        gridSpan: { w: 6, h: 1 },
        query: {
          expression: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))',
          step: '1m',
          metric: 'http_requests_total',
          aggregation: 'p99',
        },
        threshold: { operator: '>', warning: 200, critical: 450 },
      },
      {
        id: 'w-error-rate',
        title: '5xx Error Rate Ratio (%)',
        type: 'stat',
        unit: '%',
        gridSpan: { w: 3, h: 1 },
        query: {
          expression: 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
          step: '1m',
          metric: 'error_rate',
          aggregation: 'rate',
        },
        threshold: { operator: '>', warning: 2, critical: 5 },
      },
      {
        id: 'w-throughput',
        title: 'Global Ingestion RPS',
        type: 'stat',
        unit: 'req/s',
        gridSpan: { w: 3, h: 1 },
        query: {
          expression: 'sum(rate(http_requests_total[5m]))',
          step: '1m',
          metric: 'http_requests_total',
          aggregation: 'rate',
        },
      },
      {
        id: 'w-db-heatmap',
        title: 'Database Query Duration Density Matrix',
        type: 'heatmap',
        unit: 'ms',
        gridSpan: { w: 6, h: 1 },
        query: {
          expression: 'sum(rate(db_query_duration_ms_bucket[5m])) by (le)',
          step: '1m',
          metric: 'db_query_duration_ms',
          aggregation: 'p95',
        },
      },
      {
        id: 'w-cpu-dist',
        title: 'Cluster Node CPU & Memory Distribution',
        type: 'distribution',
        unit: '%',
        gridSpan: { w: 6, h: 1 },
        query: {
          expression: 'avg(cpu_utilization) by (instance)',
          step: '1m',
          metric: 'cpu_utilization',
          aggregation: 'avg',
        },
        threshold: { operator: '>', warning: 75, critical: 90 },
      },
    ],
  },
  {
    id: 'preset-microservices',
    name: 'API Microservices & Mesh Topology',
    description: 'Endpoint RPS breakdown, service-to-service spans, and database pool saturation',
    category: 'Microservices',
    tags: ['microservices', 'mesh', 'api'],
    createdAt: 1700000010000,
    widgets: [
      {
        id: 'w-service-rps',
        title: 'Throughput by Service Endpoint',
        type: 'line',
        unit: 'req/s',
        gridSpan: { w: 6, h: 1 },
        query: {
          expression: 'sum(rate(http_requests_total[5m])) by (service)',
          step: '1m',
          metric: 'http_requests_total',
          aggregation: 'sum_by',
        },
      },
      {
        id: 'w-db-latency',
        title: 'Database Connection Pool Saturation',
        type: 'stat',
        unit: 'ms',
        gridSpan: { w: 6, h: 1 },
        query: {
          expression: 'avg_over_time(db_query_duration_ms[5m])',
          step: '1m',
          metric: 'db_query_duration_ms',
          aggregation: 'avg',
        },
        threshold: { operator: '>', warning: 100, critical: 250 },
      },
    ],
  },
];

let inMemoryPresets: DashboardPresetPayload[] = [...defaultPresets];

export const presetsRouter = Router();

presetsRouter.get('/', (req: Request, res: Response) => {
  res.json({
    count: inMemoryPresets.length,
    presets: inMemoryPresets,
  });
});

presetsRouter.post('/', (req: Request, res: Response) => {
  const payload = req.body as DashboardPresetPayload;
  if (!payload || !payload.name) {
    return res.status(400).json({ error: 'Preset name is required.' });
  }

  const newPreset: DashboardPresetPayload = {
    id: payload.id || `preset-custom-${Date.now()}`,
    name: payload.name,
    description: payload.description || 'Custom dashboard layout preset',
    category: (payload.category as any) || 'Custom',
    widgets: payload.widgets || [],
    tags: payload.tags || ['custom'],
    createdAt: Date.now(),
  };

  // Replace if exists, else append
  const idx = inMemoryPresets.findIndex((p) => p.id === newPreset.id);
  if (idx >= 0) {
    inMemoryPresets[idx] = newPreset;
  } else {
    inMemoryPresets.push(newPreset);
  }

  res.status(201).json({
    message: 'Preset saved successfully',
    preset: newPreset,
  });
});

presetsRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const initialLen = inMemoryPresets.length;
  inMemoryPresets = inMemoryPresets.filter((p) => p.id !== id);

  if (inMemoryPresets.length === initialLen) {
    return res.status(404).json({ error: `Preset with id ${id} not found.` });
  }

  res.json({ message: `Preset ${id} deleted successfully.` });
});
