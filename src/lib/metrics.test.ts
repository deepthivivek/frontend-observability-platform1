import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DashboardMetricsSchema,
  fetchDashboardMetrics,
  getDeltaPresentation,
} from './metrics';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getDeltaPresentation', () => {
  it('shows green upward arrow when higherIsBetter is true and change is positive', () => {
    expect(getDeltaPresentation(12.34, true)).toEqual({
      arrow: '↑',
      colorClass: 'text-emerald-400',
      formattedValue: '+12.3%',
      isImprovement: true,
    });
  });

  it('shows rose downward arrow when higherIsBetter is true and change is negative', () => {
    expect(getDeltaPresentation(-4.5, true)).toEqual({
      arrow: '↓',
      colorClass: 'text-rose-400',
      formattedValue: '-4.5%',
      isImprovement: false,
    });
  });

  it('shows green downward arrow when higherIsBetter is false (latency/error reduction)', () => {
    expect(getDeltaPresentation(-8.2, false)).toEqual({
      arrow: '↓',
      colorClass: 'text-emerald-400',
      formattedValue: '-8.2%',
      isImprovement: true,
    });
  });

  it('shows rose upward arrow when higherIsBetter is false and metric increased', () => {
    expect(getDeltaPresentation(5.0, false)).toEqual({
      arrow: '↑',
      colorClass: 'text-rose-400',
      formattedValue: '+5.0%',
      isImprovement: false,
    });
  });

  it('shows neutral slate arrow for zero change', () => {
    expect(getDeltaPresentation(0, true)).toEqual({
      arrow: '→',
      colorClass: 'text-slate-400',
      formattedValue: '0.0%',
      isImprovement: null,
    });
  });
});

describe('DashboardMetricsSchema & fetchDashboardMetrics', () => {
  it('validates well-formed telemetry payloads', () => {
    const parsed = DashboardMetricsSchema.parse({
      isSynthetic: true,
      generatedAt: '2026-11-24T11:30:00Z',
      timeframe: '24h',
      stats: [
        {
          id: 'latency',
          label: 'Latency',
          value: 120,
          unit: 'ms',
          changePercent: -5.2,
          higherIsBetter: false,
        },
      ],
      performanceData: [
        {
          timestamp: '2026-11-24T11:00:00Z',
          label: '11:00',
          latencyMs: 120,
          requests: 400,
          errorRate: 0.4,
        },
      ],
      endpoints: [
        {
          id: 'ep-1',
          name: 'Auth Login',
          method: 'POST',
          path: '/api/v1/auth/login',
          status: 'Healthy',
          responseTimeMs: 42,
          uptimePercent: 99.99,
          lastChecked: '2026-11-24T11:30:00Z',
        },
      ],
    });

    expect(parsed.endpoints).toHaveLength(1);
    expect(parsed.stats[0].higherIsBetter).toBe(false);
  });

  it('throws ZodError when API returns malformed payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          isSynthetic: true,
          generatedAt: '2026-11-24T11:30:00Z',
          stats: 'not-an-array',
          performanceData: [],
          endpoints: [],
        }),
      })
    );

    await expect(fetchDashboardMetrics()).rejects.toThrow();
  });

  it('throws descriptive error when API responds with HTTP 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Simulated telemetry service failure (HTTP 500)' }),
      })
    );

    await expect(fetchDashboardMetrics({ simulateError: true })).rejects.toThrow(
      /Simulated telemetry service failure/i
    );
  });
});
