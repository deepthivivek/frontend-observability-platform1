'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AggregatedMetrics, ApiRequestLog } from '../types/telemetry';
import { AlertRule, Incident, IncidentTimelineEvent } from '../types/alert';

export function useAlertEvaluator(
  metrics: AggregatedMetrics | null,
  logs: ApiRequestLog[],
  activeRules: AlertRule[]
) {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  // Flapping damping violation tracker: Map<ruleId, consecutiveViolationsCount>
  const violationCounts = useRef<Map<string, number>>(new Map());

  // Deduplication & Root Cause clustering map: Map<ruleId, rootIncidentId>
  const activeRootIncidents = useRef<Map<string, string>>(new Map());

  // Keep a stable ref to logs so changing log array references don't trigger re-evaluation
  const logsRef = useRef(logs);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Track metric signature to prevent redundant evaluation cycles
  const lastEvaluatedMetrics = useRef<string>('');
  const metricsSignature = metrics
    ? `${metrics.totalRequests}-${metrics.p95Latency}-${metrics.successRate}-${metrics.avgLatency}-${activeRules.length}`
    : '';

  // Continuous evaluation of worker telemetry metrics against active rules
  useEffect(() => {
    if (!metrics || activeRules.length === 0) return;
    if (lastEvaluatedMetrics.current === metricsSignature) return;
    lastEvaluatedMetrics.current = metricsSignature;

    let hasPotentialChanges = false;

    activeRules.forEach((rule) => {
      if (!rule.enabled) return;

      // Check maintenance silencing window
      if (rule.silencingWindow?.enabled) {
        const now = Date.now();
        const start = new Date(rule.silencingWindow.startIso).getTime();
        const end = new Date(rule.silencingWindow.endIso).getTime();
        if (now >= start && now <= end) {
          return; // Silenced
        }
      }

      // Extract observed metric value
      let observedValue = 0;
      if (rule.metric === 'latency') {
        observedValue = metrics.p95Latency || metrics.avgLatency;
      } else if (rule.metric === 'error_rate') {
        observedValue = Number((100 - metrics.successRate).toFixed(1));
      } else if (rule.metric === 'rps') {
        observedValue = Math.round(metrics.totalRequests / 60);
      } else if (rule.metric === 'slo_burn') {
        const errPct = 100 - metrics.successRate;
        observedValue = Number((errPct / 0.1).toFixed(1)); // SLO target 99.9%
      }

      // Evaluate condition
      const isBreaching =
        rule.operator === '>'
          ? observedValue > rule.threshold
          : rule.operator === '<'
          ? observedValue < rule.threshold
          : observedValue === rule.threshold;

      const currentCount = violationCounts.current.get(rule.id) || 0;

      if (isBreaching) {
        const newCount = currentCount + 1;
        violationCounts.current.set(rule.id, newCount);

        if (newCount >= rule.flappingDampingCount) {
          hasPotentialChanges = true;
        }
      } else {
        violationCounts.current.set(rule.id, 0);
      }
    });

    if (!hasPotentialChanges) return;

    setIncidents((prev) => {
      let stateChanged = false;
      let nextIncidents = [...prev];

      activeRules.forEach((rule) => {
        if (!rule.enabled) return;

        // Check silencing
        if (rule.silencingWindow?.enabled) {
          const now = Date.now();
          const start = new Date(rule.silencingWindow.startIso).getTime();
          const end = new Date(rule.silencingWindow.endIso).getTime();
          if (now >= start && now <= end) return;
        }

        const count = violationCounts.current.get(rule.id) || 0;
        if (count < rule.flappingDampingCount) return;

        let observedValue = 0;
        if (rule.metric === 'latency') {
          observedValue = metrics.p95Latency || metrics.avgLatency;
        } else if (rule.metric === 'error_rate') {
          observedValue = Number((100 - metrics.successRate).toFixed(1));
        } else if (rule.metric === 'rps') {
          observedValue = Math.round(metrics.totalRequests / 60);
        } else if (rule.metric === 'slo_burn') {
          const errPct = 100 - metrics.successRate;
          observedValue = Number((errPct / 0.1).toFixed(1));
        }

        const existingIdx = nextIncidents.findIndex(
          (inc) => inc.ruleId === rule.id && inc.status !== 'resolved'
        );

        if (existingIdx !== -1) {
          const existing = nextIncidents[existingIdx];
          if (existing.currentValue !== observedValue) {
            nextIncidents[existingIdx] = {
              ...existing,
              currentValue: observedValue,
            };
            stateChanged = true;
          }
        } else {
          const currentLogs = logsRef.current;
          const badLog = currentLogs.find((l) =>
            rule.metric === 'latency'
              ? l.latencyMs > rule.threshold
              : l.statusCode >= 400
          );

          const timeline: IncidentTimelineEvent[] = [
            {
              timestamp: Date.now(),
              event: `Threshold violated: observed ${observedValue}${rule.unit} (${rule.operator} ${rule.threshold}${rule.unit})`,
              metricValue: observedValue,
            },
          ];

          const newIncident: Incident = {
            id: `inc-${rule.id}-${Date.now()}`,
            ruleId: rule.id,
            title: rule.name,
            severity: rule.severity,
            status: 'firing',
            startedAt: Date.now(),
            currentValue: observedValue,
            threshold: rule.threshold,
            environment: rule.environment,
            service: rule.serviceScope || 'Cluster Primary',
            rootCauseTraceId: badLog?.traceId || currentLogs[0]?.traceId,
            subAlertsCount: 1,
            timeline,
          };

          nextIncidents = [newIncident, ...nextIncidents];
          stateChanged = true;
        }
      });

      return stateChanged ? nextIncidents : prev;
    });
  }, [metrics, activeRules, metricsSignature]);

  // Acknowledge Incident with Triage Notes
  const acknowledgeIncident = useCallback((id: string, notes: string) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? {
              ...inc,
              status: 'acknowledged',
              acknowledgedAt: Date.now(),
              acknowledgedBy: 'Current On-Call Engineer',
              acknowledgementNotes: notes,
              timeline: [
                ...inc.timeline,
                {
                  timestamp: Date.now(),
                  event: `Incident Acknowledged with triage notes: "${notes}"`,
                  author: 'Current On-Call Engineer',
                },
              ],
            }
          : inc
      )
    );
  }, []);

  // Resolve Incident
  const resolveIncident = useCallback((id: string) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? {
              ...inc,
              status: 'resolved',
              resolvedAt: Date.now(),
              timeline: [
                ...inc.timeline,
                {
                  timestamp: Date.now(),
                  event: 'Incident Resolved: metrics restored to baseline tolerance',
                  author: 'Automated Monitor',
                },
              ],
            }
          : inc
      )
    );
  }, []);

  // Trigger automated remediation
  const triggerRemediation = useCallback((id: string) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? {
              ...inc,
              remediationTriggered: 'Flush Redis L2 Cache & Reset Connection Pool',
              timeline: [
                ...inc.timeline,
                {
                  timestamp: Date.now(),
                  event: 'Self-Healing Webhook Triggered: Flush Redis L2 Cache & Reset Connection Pool',
                  author: 'Remediation Bot',
                },
              ],
            }
          : inc
      )
    );
  }, []);

  return {
    incidents,
    setIncidents,
    acknowledgeIncident,
    resolveIncident,
    triggerRemediation,
  };
}
