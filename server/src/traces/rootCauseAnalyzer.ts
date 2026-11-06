import { TraceSpan } from '../../../src/types/trace';

export interface RootCauseInsight {
  bottleneckSpanId: string;
  serviceName: string;
  spanName: string;
  reason: string;
  remediation: string;
  durationMs: number;
  percentageOfTrace: number;
}

export class RootCauseAnalyzer {
  public analyzeTrace(spans: TraceSpan[]): RootCauseInsight | null {
    if (!spans || spans.length === 0) return null;

    const rootSpan = spans.find((s) => !s.parentSpanId) || spans[0];
    const totalDuration = rootSpan.durationMs || Math.max(...spans.map((s) => s.durationMs), 1);

    // 1. Check for leaf spans that failed with 5xx or unhandled exceptions
    const errorSpans = spans.filter((s) => (s.statusCode ?? 200) >= 500 || s.attributes?.['error'] === true);
    
    // Find the deepest error span (a leaf or furthest child error)
    if (errorSpans.length > 0) {
      // Find error span with no child error spans
      const deepestError = errorSpans.find((es) => {
        const esId = es.spanId || es.id;
        return !errorSpans.some((child) => child.parentSpanId === esId);
      }) || errorSpans[0];

      const pct = parseFloat(((deepestError.durationMs / totalDuration) * 100).toFixed(1));
      const reason = this.inferErrorReason(deepestError);
      const remediation = this.inferRemediation(deepestError, reason);

      return {
        bottleneckSpanId: deepestError.spanId || deepestError.id || 'span-unknown',
        serviceName: deepestError.serviceName || deepestError.service || 'unknown-service',
        spanName: deepestError.name,
        reason,
        remediation,
        durationMs: deepestError.durationMs,
        percentageOfTrace: pct,
      };
    }

    // 2. Check for anomalous latency spans (Z-Score >= 3.5 or highest duration leaf)
    const anomalySpans = spans.filter((s) => s.isAnomaly || (s.zScore && s.zScore >= 3.5));
    if (anomalySpans.length > 0) {
      // Pick the anomaly span with the largest duration
      const worstAnomaly = anomalySpans.reduce((max, s) => (s.durationMs > max.durationMs ? s : max), anomalySpans[0]);
      const pct = parseFloat(((worstAnomaly.durationMs / totalDuration) * 100).toFixed(1));
      const sName = worstAnomaly.serviceName || worstAnomaly.service || 'unknown-service';
      const reason = `Statistical latency anomaly: Z-Score ${worstAnomaly.zScore || 3.8}σ above moving average on ${sName}.`;
      const remediation = this.inferRemediation(worstAnomaly, reason);

      return {
        bottleneckSpanId: worstAnomaly.spanId || worstAnomaly.id || 'span-unknown',
        serviceName: sName,
        spanName: worstAnomaly.name,
        reason,
        remediation,
        durationMs: worstAnomaly.durationMs,
        percentageOfTrace: pct,
      };
    }

    // 3. Check for longest executing leaf span taking > 40% of total trace duration
    const leafSpans = spans.filter((s) => !spans.some((child) => child.parentSpanId === (s.spanId || s.id)));
    const longestLeaf = leafSpans.reduce((max, s) => (s.durationMs > max.durationMs ? s : max), leafSpans[0]);

    if (longestLeaf && longestLeaf.durationMs > totalDuration * 0.4) {
      const pct = parseFloat(((longestLeaf.durationMs / totalDuration) * 100).toFixed(1));
      const sName = longestLeaf.serviceName || longestLeaf.service || 'unknown-service';
      const reason = `High duration leaf bottleneck (${longestLeaf.durationMs}ms, ${pct}% of total trace) in ${sName}.`;
      const remediation = this.inferRemediation(longestLeaf, reason);

      return {
        bottleneckSpanId: longestLeaf.spanId || longestLeaf.id || 'span-unknown',
        serviceName: sName,
        spanName: longestLeaf.name,
        reason,
        remediation,
        durationMs: longestLeaf.durationMs,
        percentageOfTrace: pct,
      };
    }

    return null;
  }

  private inferErrorReason(span: TraceSpan): string {
    const sName = span.serviceName || span.service || 'unknown-service';
    const nameLower = (span.name + ' ' + (span.attributes?.['db.statement'] || '')).toLowerCase();
    const serviceLower = sName.toLowerCase();

    if (span.statusCode === 504) {
      return `Upstream gateway timeout (504): service '${sName}' timed out waiting for downstream dependencies.`;
    }
    if (serviceLower.includes('db') || nameLower.includes('select') || nameLower.includes('query')) {
      return `Database query failure on ${sName}: connection pool exhaustion or query lock timeout.`;
    }
    if (serviceLower.includes('payment') || nameLower.includes('stripe') || nameLower.includes('charge')) {
      return `Third-party payment gateway error (HTTP ${span.statusCode || 500}) during transaction settlement.`;
    }
    if (serviceLower.includes('auth') || nameLower.includes('token') || nameLower.includes('session')) {
      return `Authentication authority rejection: signature verification failed or token expired.`;
    }
    return `Unhandled server exception (HTTP ${span.statusCode || 500}) encountered on ${sName} endpoint ${span.name}.`;
  }

  private inferRemediation(span: TraceSpan, reason: string): string {
    const s = (span.serviceName || span.service || '').toLowerCase();
    const r = reason.toLowerCase();

    if (r.includes('database') || s.includes('db')) {
      return 'Scale read-replicas, add composite index on queried columns, or expand HikariCP max connection pool.';
    }
    if (r.includes('timeout') || span.statusCode === 504) {
      return 'Tune downstream socket timeouts, enable circuit breaker shedding on degraded endpoints, or scale worker pods.';
    }
    if (s.includes('payment') || r.includes('payment')) {
      return 'Verify external API credentials, implement exponential backoff retry jitter, or failover to secondary merchant gateway.';
    }
    if (s.includes('auth')) {
      return 'Flush stale Redis JWT revocation blacklist and verify NTP clock drift across auth pods.';
    }
    return 'Inspect pod stderr logs, deploy rolling patch release, or restart saturated service instances.';
  }
}

export const rootCauseAnalyzer = new RootCauseAnalyzer();
