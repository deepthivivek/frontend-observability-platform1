/**
 * Adaptive Sampling & Rate-Limiting Policy Manager (Day 16)
 * Enforces policy-as-code adaptive sampling rules to intelligently downsample or drop
 * low-priority telemetry while preserving 100% of 5xx server errors and anomalies.
 */

import { SamplingPolicyRule } from '../../../src/types/governance';

export class SamplingPolicyManager {
  private rules: Map<string, SamplingPolicyRule> = new Map([
    [
      'rule-200-ok-logs',
      {
        id: 'rule-200-ok-logs',
        name: 'HTTP 200 OK Trace Downsampler',
        targetMetricOrEndpoint: 'GET /health & 2xx Telemetry',
        sampleRatePercent: 10,
        preserveErrors: true,
        priority: 'LOW',
        enabled: true,
      },
    ],
    [
      'rule-5xx-errors',
      {
        id: 'rule-5xx-errors',
        name: 'Critical 5xx Server Error Fortress',
        targetMetricOrEndpoint: 'HTTP 5xx & Unhandled Exceptions',
        sampleRatePercent: 100,
        preserveErrors: true,
        priority: 'CRITICAL',
        enabled: true,
      },
    ],
    [
      'rule-debug-logs',
      {
        id: 'rule-debug-logs',
        name: 'Verbose Debug Log Shedder',
        targetMetricOrEndpoint: 'level=debug & level=trace',
        sampleRatePercent: 1,
        preserveErrors: true,
        priority: 'MEDIUM',
        enabled: true,
      },
    ],
  ]);

  public getRules(): SamplingPolicyRule[] {
    return Array.from(this.rules.values());
  }

  public saveRule(rule: SamplingPolicyRule): SamplingPolicyRule {
    this.rules.set(rule.id, rule);
    return rule;
  }

  public shouldSampleEvent(statusCode: number, isError: boolean, priorityLevel: string): {
    sampled: boolean;
    sampleRate: number;
    reason: string;
  } {
    // 100% error preservation rule
    if (isError || statusCode >= 500) {
      return {
        sampled: true,
        sampleRate: 100,
        reason: 'CRITICAL_ERROR_PRESERVATION_100_PERCENT',
      };
    }

    if (priorityLevel === 'LOW') {
      return {
        sampled: Math.random() < 0.1,
        sampleRate: 10,
        reason: 'ADAPTIVE_DOWNSAMPLE_10_PERCENT',
      };
    }

    return {
      sampled: true,
      sampleRate: 100,
      reason: 'DEFAULT_RETAIN',
    };
  }
}

export const globalSamplingPolicyManager = new SamplingPolicyManager();
