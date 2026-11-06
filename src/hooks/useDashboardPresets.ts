import { useState, useEffect, useCallback } from 'react';
import { DashboardPreset, MetricWidget } from '../types/dashboard';

const INITIAL_PRESETS: DashboardPreset[] = [
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

export function useDashboardPresets() {
  const [presets, setPresets] = useState<DashboardPreset[]>(() => INITIAL_PRESETS);
  const [activePresetId, setActivePresetId] = useState<string>('preset-sre-health');
  const [isLoading, setIsLoading] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState<MetricWidget[]>(() => INITIAL_PRESETS[0].widgets);

  // Sync with backend API
  useEffect(() => {
    let isMounted = true;
    const loadBackendPresets = async () => {
      try {
        const res = await fetch('/api/v1/dashboards/presets');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.presets) && data.presets.length > 0) {
            setPresets(data.presets);
          }
        }
      } catch {
        // Offline fallback to initial state
      }
    };
    loadBackendPresets();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectPreset = useCallback(
    (presetId: string) => {
      const found = presets.find((p) => p.id === presetId);
      if (found) {
        setActivePresetId(presetId);
        setActiveWidgets(found.widgets);
      }
    },
    [presets]
  );

  const savePreset = useCallback(
    async (presetName: string, description: string, widgets: MetricWidget[], category: DashboardPreset['category'] = 'Custom') => {
      const newPreset: DashboardPreset = {
        id: `preset-custom-${Date.now()}`,
        name: presetName,
        description,
        category,
        widgets,
        tags: ['custom', category.toLowerCase()],
        createdAt: Date.now(),
      };

      setPresets((prev) => [newPreset, ...prev]);
      setActivePresetId(newPreset.id);

      try {
        await fetch('/api/v1/dashboards/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPreset),
        });
      } catch {
        // Ignored
      }
    },
    []
  );

  const deletePreset = useCallback(async (presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));

    try {
      await fetch(`/api/v1/dashboards/presets/${presetId}`, {
        method: 'DELETE',
      });
    } catch {
      // Ignored
    }
  }, []);

  const exportPresetsJSON = useCallback(() => {
    const jsonStr = JSON.stringify(presets, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neon-chasm-dashboard-presets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [presets]);

  const importPresetsJSON = useCallback((jsonContent: string) => {
    try {
      const parsed = JSON.parse(jsonContent);
      if (Array.isArray(parsed)) {
        setPresets(parsed);
        if (parsed[0]) {
          setActivePresetId(parsed[0].id);
          setActiveWidgets(parsed[0].widgets);
        }
      }
    } catch (err) {
      console.error('Invalid preset JSON format:', err);
    }
  }, []);

  return {
    presets,
    activePresetId,
    activeWidgets,
    setActiveWidgets,
    selectPreset,
    savePreset,
    deletePreset,
    isLoading,
    exportPresetsJSON,
    importPresetsJSON,
  };
}
