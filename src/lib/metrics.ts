import { z } from 'zod';

export const EndpointStatusSchema = z.enum(['Healthy', 'Warning', 'Failed']);
export type EndpointStatus = z.infer<typeof EndpointStatusSchema>;

export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const TimeframeSchema = z.enum(['15m', '1h', '24h', '7d']);
export type Timeframe = z.infer<typeof TimeframeSchema>;

export const StatMetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  changePercent: z.number(),
  higherIsBetter: z.boolean(),
});
export type StatMetric = z.infer<typeof StatMetricSchema>;

export const PerformancePointSchema = z.object({
  timestamp: z.string().min(1),
  label: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  requests: z.number().nonnegative(),
  errorRate: z.number().nonnegative(),
});
export type PerformancePoint = z.infer<typeof PerformancePointSchema>;

export const EndpointRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  method: HttpMethodSchema,
  path: z.string().min(1),
  status: EndpointStatusSchema,
  responseTimeMs: z.number().nonnegative(),
  uptimePercent: z.number().min(0).max(100),
  lastChecked: z.string().min(1),
});
export type EndpointRow = z.infer<typeof EndpointRowSchema>;

export const DashboardMetricsSchema = z.object({
  isSynthetic: z.boolean(),
  generatedAt: z.string().min(1),
  timeframe: TimeframeSchema.optional().default('24h'),
  stats: z.array(StatMetricSchema),
  performanceData: z.array(PerformancePointSchema),
  endpoints: z.array(EndpointRowSchema),
});
export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>;

export interface DeltaPresentation {
  arrow: '↑' | '↓' | '→';
  colorClass: 'text-emerald-400' | 'text-rose-400' | 'text-slate-400';
  formattedValue: string;
  isImprovement: boolean | null;
}

export function getDeltaPresentation(
  changePercent: number,
  higherIsBetter: boolean
): DeltaPresentation {
  if (!Number.isFinite(changePercent) || changePercent === 0) {
    return {
      arrow: '→',
      colorClass: 'text-slate-400',
      formattedValue: '0.0%',
      isImprovement: null,
    };
  }

  const isPositiveChange = changePercent > 0;
  const arrow: '↑' | '↓' = isPositiveChange ? '↑' : '↓';
  const isImprovement = isPositiveChange ? higherIsBetter : !higherIsBetter;
  const colorClass: 'text-emerald-400' | 'text-rose-400' = isImprovement
    ? 'text-emerald-400'
    : 'text-rose-400';

  const absRounded = Math.abs(changePercent).toFixed(1);
  const formattedValue = `${isPositiveChange ? '+' : '-'}${absRounded}%`;

  return {
    arrow,
    colorClass,
    formattedValue,
    isImprovement,
  };
}

export interface FetchDashboardMetricsOptions {
  simulateError?: boolean;
  empty?: boolean;
  timeframe?: Timeframe;
}

export async function fetchDashboardMetrics(
  options: FetchDashboardMetricsOptions = {}
): Promise<DashboardMetrics> {
  const params = new URLSearchParams();
  if (options.simulateError) {
    params.set('simulateError', '1');
  }
  if (options.empty) {
    params.set('empty', '1');
  }
  if (options.timeframe) {
    params.set('timeframe', options.timeframe);
  }

  const query = params.toString();
  const url = query ? `/api/metrics?${query}` : '/api/metrics';

  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as { error?: string; message?: string };
      if (errBody?.error || errBody?.message) {
        errorDetail = errBody.error || errBody.message || errorDetail;
      }
    } catch {
      // Ignore JSON parsing failure on non-JSON error responses
    }
    throw new Error(`Unable to fetch telemetry metrics: ${errorDetail}`);
  }

  const rawData: unknown = await response.json();
  return DashboardMetricsSchema.parse(rawData);
}
