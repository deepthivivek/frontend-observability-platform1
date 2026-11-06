/**
 * High-Cardinality Detection Engine (Day 16)
 * Scans OpenTelemetry metric series & log label streams to identify explosive cardinality,
 * calculates storage bloat estimates in GB/USD, and enforces quarantine rules.
 */

import { CardinalityMetric, CardinalityRisk } from '../../../src/types/governance';

export class CardinalityEngine {
  private metricsMap: Map<string, CardinalityMetric> = new Map([
    [
      'card-http-requests',
      {
        id: 'card-http-requests',
        metricName: 'http_requests_total',
        labelCount: 145000,
        cardinalityRisk: 'EXPLOSIVE',
        estimatedStorageBloatGb: 142.5,
        estimatedCostMonthlyUsd: 1425.0,
        quarantined: false,
        offendingLabel: 'user_guid (dynamic uuid in label set)',
      },
    ],
    [
      'card-db-queries',
      {
        id: 'card-db-queries',
        metricName: 'db_query_duration_ms_bucket',
        labelCount: 48000,
        cardinalityRisk: 'HIGH',
        estimatedStorageBloatGb: 48.0,
        estimatedCostMonthlyUsd: 480.0,
        quarantined: false,
        offendingLabel: 'raw_sql_query (unparameterized query string)',
      },
    ],
    [
      'card-container-cpu',
      {
        id: 'card-container-cpu',
        metricName: 'container_cpu_usage_seconds',
        labelCount: 1200,
        cardinalityRisk: 'LOW',
        estimatedStorageBloatGb: 1.2,
        estimatedCostMonthlyUsd: 12.0,
        quarantined: false,
        offendingLabel: 'pod_name',
      },
    ],
    [
      'card-grpc-latency',
      {
        id: 'card-grpc-latency',
        metricName: 'grpc_server_handling_seconds',
        labelCount: 18500,
        cardinalityRisk: 'MEDIUM',
        estimatedStorageBloatGb: 18.5,
        estimatedCostMonthlyUsd: 185.0,
        quarantined: false,
        offendingLabel: 'client_ephemeral_port',
      },
    ],
  ]);

  public getCardinalityReport(): CardinalityMetric[] {
    return Array.from(this.metricsMap.values());
  }

  public detectLabelExplosion(labels: Record<string, string>): {
    isExplosive: boolean;
    risk: CardinalityRisk;
    offendingKeys: string[];
  } {
    const offendingKeys: string[] = [];
    let isExplosive = false;

    for (const [key, value] of Object.entries(labels)) {
      // Check for UUID patterns, IP addresses, or raw query strings in label values
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value);
      const isHighEntropy = value.length > 40;

      if (isUuid || isIp || isHighEntropy) {
        offendingKeys.push(key);
        isExplosive = true;
      }
    }

    return {
      isExplosive,
      risk: isExplosive ? (offendingKeys.length > 2 ? 'EXPLOSIVE' : 'HIGH') : 'LOW',
      offendingKeys,
    };
  }

  public quarantineMetric(metricId: string, quarantineState = true): CardinalityMetric | undefined {
    const target = this.metricsMap.get(metricId);
    if (target) {
      target.quarantined = quarantineState;
      this.metricsMap.set(metricId, target);
      return target;
    }
    return undefined;
  }
}

export const globalCardinalityEngine = new CardinalityEngine();
