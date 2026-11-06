/**
 * Telemetry Retrieval-Augmented Generation (RAG) Synthesizer (Day 13)
 * Correlates active incident alerts, error logs, trace bottlenecks, and service health
 * into a sanitized context payload for LLM incident diagnosis.
 */

import { redactTelemetryText } from './piiFilter';
import { Incident } from '../../../src/types/incident';

export interface RAGLogEntry {
  timestamp: number;
  level: string;
  service: string;
  message: string;
  stack?: string;
  traceId?: string;
}

export interface RAGTraceBottleneck {
  traceId: string;
  serviceName: string;
  spanName: string;
  durationMs: number;
  zScore?: number;
  statusCode: number;
  errorMessage?: string;
}

export interface RAGServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'critical';
  errorRate: number;
  p99LatencyMs: number;
}

export interface TelemetryRAGContext {
  incidentId: string;
  title: string;
  severity: string;
  primaryService: string;
  affectedServices: string[];
  peakErrorRate: number;
  p99LatencyMs: number;
  correlateTimestamp: number;
  topErrors: Array<{
    service: string;
    message: string;
    count: number;
    stack?: string;
  }>;
  recentLogs: RAGLogEntry[];
  traceBottlenecks: RAGTraceBottleneck[];
  serviceHealthMatrix: RAGServiceHealth[];
  blastRadius: {
    affectedUserSessions: number;
    frustrationScore: number;
    sloBurnRate: number;
    revenueImpactEstimated: number;
  };
}

export class TelemetryRAGEngine {
  /**
   * Synthesize a unified RAG context from an incident, correlated logs, and trace events.
   */
  public buildContext(
    incident: Incident,
    correlatedLogs: RAGLogEntry[] = [],
    traceBottlenecks: RAGTraceBottleneck[] = [],
    serviceHealth: RAGServiceHealth[] = []
  ): TelemetryRAGContext {
    // Sanitize logs and errors through PII redactor
    const sanitizedErrors = (incident.topErrors || []).map((err) => ({
      ...err,
      message: redactTelemetryText(err.message),
      stack: err.stack ? redactTelemetryText(err.stack) : undefined,
    }));

    const sanitizedLogs = correlatedLogs.slice(0, 15).map((log) => ({
      ...log,
      message: redactTelemetryText(log.message),
      stack: log.stack ? redactTelemetryText(log.stack) : undefined,
    }));

    const sanitizedTraces = traceBottlenecks.slice(0, 10).map((tb) => ({
      ...tb,
      errorMessage: tb.errorMessage ? redactTelemetryText(tb.errorMessage) : undefined,
    }));

    return {
      incidentId: incident.id,
      title: redactTelemetryText(incident.title),
      severity: incident.severity,
      primaryService: incident.primaryService,
      affectedServices: incident.affectedServices,
      peakErrorRate: incident.errorRatePeak,
      p99LatencyMs: incident.p99LatencyMs,
      correlateTimestamp: Date.now(),
      topErrors: sanitizedErrors,
      recentLogs: sanitizedLogs,
      traceBottlenecks: sanitizedTraces,
      serviceHealthMatrix: serviceHealth,
      blastRadius: incident.blastRadius,
    };
  }

  /**
   * Formats the RAG context into an LLM system prompt string.
   */
  public formatPromptContext(context: TelemetryRAGContext, userQuery?: string): string {
    const errorBlock = context.topErrors.length
      ? context.topErrors
          .map((e, idx) => `  ${idx + 1}. [${e.service}] (${e.count}x): ${e.message}${e.stack ? `\n     Stack: ${e.stack}` : ''}`)
          .join('\n')
      : '  No high-frequency error traces recorded.';

    const logBlock = context.recentLogs.length
      ? context.recentLogs
          .map((l) => `  - [${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] [${l.service}]: ${l.message}`)
          .join('\n')
      : '  No direct log anomalies detected in immediate time window.';

    const traceBlock = context.traceBottlenecks.length
      ? context.traceBottlenecks
          .map(
            (t) =>
              `  - Trace: ${t.traceId} | Service: ${t.serviceName} | Span: ${t.spanName} | Duration: ${t.durationMs}ms | Z-Score: ${t.zScore ?? 'N/A'}σ | Status: ${t.statusCode}${t.errorMessage ? ` | Error: ${t.errorMessage}` : ''}`
          )
          .join('\n')
      : '  No trace outlier bottlenecks identified.';

    const healthBlock = context.serviceHealthMatrix.length
      ? context.serviceHealthMatrix
          .map((h) => `  - Service: ${h.service} | Status: ${h.status.toUpperCase()} | Error Rate: ${h.errorRate}% | P99: ${h.p99LatencyMs}ms`)
          .join('\n')
      : '  All surrounding microservices reporting normal state.';

    return `=== OBSERVED INCIDENT TELEMETRY CONTEXT (RAG SYNTHESIS) ===
Incident: [${context.severity}] ${context.incidentId} - "${context.title}"
Primary Root Service: ${context.primaryService}
Affected Services: ${context.affectedServices.join(', ')}
Peak Error Rate: ${context.peakErrorRate}% | P99 Latency: ${context.p99LatencyMs}ms
Blast Radius: ${context.blastRadius.affectedUserSessions} sessions impacted | Frustration: ${context.blastRadius.frustrationScore}/100 | SLO Burn: ${context.blastRadius.sloBurnRate}x | Est. Revenue at Risk: $${context.blastRadius.revenueImpactEstimated.toLocaleString()}

TOP IDENTIFIED EXCEPTION TRACES:
${errorBlock}

CORRELATED REAL-TIME LOGS:
${logBlock}

DISTRIBUTED TRACE ANOMALY BOTTLENECKS (Z >= 3.5σ):
${traceBlock}

SERVICE DEPENDENCY MESH HEALTH:
${healthBlock}
============================================================

USER QUERY / INVESTIGATION REQUEST:
"${userQuery || 'Diagnose the incident root cause, impacted dependencies, and recommend runbook remediations.'}"`;
  }
}
