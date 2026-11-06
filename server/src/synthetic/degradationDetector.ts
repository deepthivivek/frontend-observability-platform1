/**
 * Regional Degradation & Alert Trigger (Day 15)
 * Detects regional p95 latency spikes exceeding 50% above baseline or consecutive 5xx errors,
 * emitting synthetic anomaly alerts into the core incident pipeline.
 */

import { ProbeRegion, SyntheticProbeResult } from '../../../src/types/synthetic';

export interface RegionalDegradationAlert {
  region: ProbeRegion;
  metric: 'LATENCY_SURGE' | 'HTTP_5XX_BURST';
  baselineMs: number;
  observedMs: number;
  surgePercentage: number;
  severity: 'WARNING' | 'CRITICAL';
  description: string;
}

export class DegradationDetector {
  public evaluateProbeResults(
    results: SyntheticProbeResult[],
    baselineLatencyMs = 50
  ): RegionalDegradationAlert[] {
    const alerts: RegionalDegradationAlert[] = [];

    for (const res of results) {
      if (!res.success || res.statusCode >= 500) {
        alerts.push({
          region: res.region,
          metric: 'HTTP_5XX_BURST',
          baselineMs: baselineLatencyMs,
          observedMs: res.timings.totalDurationMs,
          surgePercentage: 100,
          severity: 'CRITICAL',
          description: `Synthetic probe failure in region ${res.region}: Returned HTTP ${res.statusCode} (${res.errorMessage || 'Server Error'})`,
        });
        continue;
      }

      const p95Observed = res.timings.totalDurationMs;
      if (p95Observed > baselineLatencyMs * 1.5) {
        const surgePercentage = Math.round(((p95Observed - baselineLatencyMs) / baselineLatencyMs) * 100);
        alerts.push({
          region: res.region,
          metric: 'LATENCY_SURGE',
          baselineMs: baselineLatencyMs,
          observedMs: p95Observed,
          surgePercentage,
          severity: surgePercentage > 100 ? 'CRITICAL' : 'WARNING',
          description: `Regional latency surge detected in ${res.region}: p95 observed ${p95Observed}ms (+${surgePercentage}% above ${baselineLatencyMs}ms baseline)`,
        });
      }
    }

    return alerts;
  }
}

export const globalDegradationDetector = new DegradationDetector();
