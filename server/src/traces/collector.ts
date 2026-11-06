import Database from 'better-sqlite3';
import { TraceSpan, TraceSpanNode, TraceTree, TraceSummary, TraceFilterOptions } from '../../../src/types/trace';
import { anomalyDetector } from './anomalyDetector';
import { rootCauseAnalyzer } from './rootCauseAnalyzer';
import { serviceTopologyAggregator } from './serviceMap';

export class TraceCollector {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.initSchema();
    this.seedDefaultTraces();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS spans (
        traceId TEXT NOT NULL,
        spanId TEXT PRIMARY KEY,
        parentSpanId TEXT,
        serviceName TEXT NOT NULL,
        name TEXT NOT NULL,
        startTimeMs INTEGER NOT NULL,
        durationMs REAL NOT NULL,
        statusCode INTEGER NOT NULL,
        attributes TEXT NOT NULL,
        isAnomaly INTEGER DEFAULT 0,
        zScore REAL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_spans_traceId ON spans(traceId);
      CREATE INDEX IF NOT EXISTS idx_spans_serviceName ON spans(serviceName);
      CREATE INDEX IF NOT EXISTS idx_spans_durationMs ON spans(durationMs);
      CREATE INDEX IF NOT EXISTS idx_spans_isAnomaly ON spans(isAnomaly);
      CREATE INDEX IF NOT EXISTS idx_spans_startTimeMs ON spans(startTimeMs);
    `);
  }

  public ingestSpan(span: TraceSpan): { span: TraceSpan; isAnomaly: boolean; zScore: number } {
    const sName = span.serviceName || span.service || 'unknown-service';
    const tId = span.traceId || `trace-${Date.now()}`;
    const sId = span.spanId || span.id || `span-${Date.now()}`;
    const sTime = span.startTimeMs ?? Date.now();
    const sCode = span.statusCode ?? 200;

    // 1. Evaluate Z-score statistical anomaly
    const zResult = anomalyDetector.recordAndEvaluate(sName, span.name, span.durationMs);
    const isAnomaly = zResult.isAnomaly || span.isAnomaly || false;
    const zScore = zResult.zScore || span.zScore || 0;

    const spanWithAnomaly: TraceSpan = {
      ...span,
      serviceName: sName,
      traceId: tId,
      spanId: sId,
      startTimeMs: sTime,
      statusCode: sCode,
      attributes: span.attributes || {},
      isAnomaly,
      zScore,
    };

    // 2. Persist in SQLite index
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO spans (
        traceId, spanId, parentSpanId, serviceName, name,
        startTimeMs, durationMs, statusCode, attributes, isAnomaly, zScore
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      spanWithAnomaly.traceId,
      spanWithAnomaly.spanId,
      spanWithAnomaly.parentSpanId || null,
      spanWithAnomaly.serviceName,
      spanWithAnomaly.name,
      spanWithAnomaly.startTimeMs,
      spanWithAnomaly.durationMs,
      spanWithAnomaly.statusCode,
      JSON.stringify(spanWithAnomaly.attributes || {}),
      isAnomaly ? 1 : 0,
      zScore
    );

    // 3. Update service topology
    let parentSpan: TraceSpan | undefined;
    if (span.parentSpanId) {
      const parentRow = this.db.prepare('SELECT * FROM spans WHERE spanId = ?').get(span.parentSpanId) as any;
      if (parentRow) {
        parentSpan = this.mapRowToSpan(parentRow);
      }
    }
    serviceTopologyAggregator.recordSpan(spanWithAnomaly, parentSpan);

    return { span: spanWithAnomaly, isAnomaly, zScore };
  }

  public ingestBatch(spans: TraceSpan[]): { ingestedCount: number; anomaliesCount: number } {
    let anomaliesCount = 0;
    const insertMany = this.db.transaction((items: TraceSpan[]) => {
      for (const item of items) {
        const res = this.ingestSpan(item);
        if (res.isAnomaly) anomaliesCount++;
      }
    });

    insertMany(spans);
    return { ingestedCount: spans.length, anomaliesCount };
  }

  public getTraceById(traceId: string): TraceTree | null {
    const rows = this.db.prepare('SELECT * FROM spans WHERE traceId = ? ORDER BY startTimeMs ASC').all(traceId) as any[];
    if (!rows || rows.length === 0) return null;

    const spans: TraceSpan[] = rows.map((r) => this.mapRowToSpan(r));

    // Reconstruct hierarchical tree
    const rootCandidate = spans.find((s) => !s.parentSpanId) || spans[0];
    const rootStartTime = rootCandidate.startTimeMs || Date.now();

    const spanMap = new Map<string, TraceSpanNode>();
    for (const s of spans) {
      const sId = s.spanId || s.id || `span-${Math.random()}`;
      const node: TraceSpanNode = {
        ...s,
        traceId: s.traceId || traceId,
        spanId: sId,
        serviceName: s.serviceName || s.service || 'unknown-service',
        startTimeMs: s.startTimeMs || rootStartTime,
        statusCode: s.statusCode ?? 200,
        attributes: s.attributes || {},
        children: [],
        depth: 0,
        offsetMs: Math.max(0, (s.startTimeMs || rootStartTime) - rootStartTime),
      };
      spanMap.set(sId, node);
    }

    let rootNode: TraceSpanNode | null = null;
    for (const node of spanMap.values()) {
      if (node.parentSpanId && spanMap.has(node.parentSpanId)) {
        const parent = spanMap.get(node.parentSpanId)!;
        parent.children.push(node);
      } else {
        if (!rootNode) {
          rootNode = node;
        }
      }
    }

    if (!rootNode) {
      rootNode = spanMap.values().next().value || null;
    }

    if (!rootNode) return null;

    // Assign depths recursively
    const assignDepth = (n: TraceSpanNode, d: number) => {
      n.depth = d;
      for (const child of n.children) {
        assignDepth(child, d + 1);
      }
    };
    assignDepth(rootNode, 0);

    // Root-cause attribution analysis
    const rootCause = rootCauseAnalyzer.analyzeTrace(spans);

    const services = Array.from(new Set(spans.map((s) => s.serviceName || s.service || 'unknown')));
    const hasAnomalies = spans.some((s) => s.isAnomaly || (s.zScore && s.zScore >= 3.5));
    const hasErrors = spans.some((s) => (s.statusCode ?? 200) >= 500);
    const totalDurationMs = Math.max(
      ...Array.from(spanMap.values()).map((s) => s.offsetMs + s.durationMs),
      rootNode.durationMs
    );

    return {
      traceId,
      rootSpan: rootNode,
      spansCount: spans.length,
      totalDurationMs,
      hasAnomalies,
      hasErrors,
      services,
      timestamp: rootStartTime,
      rootCause: rootCause
        ? {
            bottleneckSpanId: rootCause.bottleneckSpanId,
            serviceName: rootCause.serviceName,
            reason: rootCause.reason,
            remediation: rootCause.remediation,
          }
        : undefined,
    };
  }

  public getTraces(filters?: TraceFilterOptions): TraceSummary[] {
    const traceIds = this.db.prepare('SELECT DISTINCT traceId FROM spans ORDER BY startTimeMs DESC').all() as Array<{ traceId: string }>;
    const results: TraceSummary[] = [];

    for (const { traceId } of traceIds) {
      const tree = this.getTraceById(traceId);
      if (!tree) continue;

      // Filter checks
      if (filters?.serviceName && !tree.services.includes(filters.serviceName)) {
        continue;
      }
      if (filters?.minDurationMs && tree.totalDurationMs < filters.minDurationMs) {
        continue;
      }
      if (filters?.hasError !== undefined && tree.hasErrors !== filters.hasError) {
        continue;
      }
      if (filters?.onlyAnomalies && !tree.hasAnomalies) {
        continue;
      }
      if (filters?.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matches =
          tree.traceId.toLowerCase().includes(q) ||
          tree.rootSpan.name.toLowerCase().includes(q) ||
          tree.services.some((s) => s.toLowerCase().includes(q));
        if (!matches) continue;
      }

      results.push({
        traceId: tree.traceId,
        rootServiceName: tree.rootSpan.serviceName,
        rootEndpoint: tree.rootSpan.name,
        startTimeMs: tree.timestamp,
        totalDurationMs: tree.totalDurationMs,
        spanCount: tree.spansCount,
        statusCode: tree.rootSpan.statusCode,
        hasErrors: tree.hasErrors,
        hasAnomalies: tree.hasAnomalies,
        services: tree.services,
        rootCauseService: tree.rootCause?.serviceName,
        rootCauseReason: tree.rootCause?.reason,
      });
    }

    return results;
  }

  private mapRowToSpan(row: any): TraceSpan {
    return {
      traceId: row.traceId,
      spanId: row.spanId,
      parentSpanId: row.parentSpanId || undefined,
      serviceName: row.serviceName,
      name: row.name,
      startTimeMs: row.startTimeMs,
      durationMs: row.durationMs,
      statusCode: row.statusCode,
      attributes: row.attributes ? JSON.parse(row.attributes) : {},
      isAnomaly: Boolean(row.isAnomaly),
      zScore: row.zScore,
    };
  }

  private seedDefaultTraces() {
    const baseTime = Date.now() - 1000 * 60 * 15;

    // Baseline spans to prime Z-score statistics for api-gateway, order-service, inventory-db
    for (let i = 0; i < 20; i++) {
      anomalyDetector.recordAndEvaluate('api-gateway', 'POST /api/v1/orders/checkout', 45 + (i % 5) * 2);
      anomalyDetector.recordAndEvaluate('order-service', 'ProcessOrderTransaction', 120 + (i % 5) * 4);
      anomalyDetector.recordAndEvaluate('inventory-db', 'SELECT * FROM inventory WHERE sku = ?', 18 + (i % 3) * 2);
    }

    // 1. High Latency Anomaly Trace: Checkout Bottleneck with Z-score 4.8σ
    const trace1Spans: TraceSpan[] = [
      {
        traceId: 'tr-checkout-anomaly-901',
        spanId: 'span-root-01',
        serviceName: 'api-gateway',
        name: 'POST /api/v1/orders/checkout',
        startTimeMs: baseTime + 1000,
        durationMs: 1480,
        statusCode: 200,
        attributes: { 'http.method': 'POST', 'client.ip': '192.168.1.101', 'user.tier': 'enterprise' },
      },
      {
        traceId: 'tr-checkout-anomaly-901',
        spanId: 'span-auth-02',
        parentSpanId: 'span-root-01',
        serviceName: 'auth-service',
        name: 'ValidateBearerSessionToken',
        startTimeMs: baseTime + 1010,
        durationMs: 35,
        statusCode: 200,
        attributes: { 'auth.algorithm': 'RS256', 'auth.cached': true },
      },
      {
        traceId: 'tr-checkout-anomaly-901',
        spanId: 'span-redis-03',
        parentSpanId: 'span-auth-02',
        serviceName: 'redis-cache',
        name: 'MGET session:usr_9981',
        startTimeMs: baseTime + 1015,
        durationMs: 8,
        statusCode: 200,
        attributes: { 'db.system': 'redis', 'redis.key_count': 1 },
      },
      {
        traceId: 'tr-checkout-anomaly-901',
        spanId: 'span-order-04',
        parentSpanId: 'span-root-01',
        serviceName: 'order-service',
        name: 'ProcessOrderTransaction',
        startTimeMs: baseTime + 1050,
        durationMs: 1420,
        statusCode: 200,
        attributes: { 'order.id': 'ord-live-8831', 'cart.items_count': 4 },
      },
      {
        traceId: 'tr-checkout-anomaly-901',
        spanId: 'span-db-05',
        parentSpanId: 'span-order-04',
        serviceName: 'inventory-db',
        name: 'SELECT * FROM inventory WHERE sku = ?',
        startTimeMs: baseTime + 1060,
        durationMs: 1350, // Massive Z-score outlier!
        statusCode: 200,
        isAnomaly: true,
        zScore: 4.82,
        attributes: {
          'db.statement': 'SELECT * FROM inventory WHERE sku = ? FOR UPDATE',
          'db.system': 'postgresql',
          'db.wait_lock_ms': 1280,
        },
      },
    ];

    // 2. Cascading 504 Timeout Failure: Payment Gateway Outage
    const trace2Spans: TraceSpan[] = [
      {
        traceId: 'tr-payment-timeout-902',
        spanId: 'span-gw-11',
        serviceName: 'api-gateway',
        name: 'POST /api/v1/payments/charge',
        startTimeMs: baseTime + 40000,
        durationMs: 2500,
        statusCode: 504,
        attributes: { 'http.method': 'POST', 'error': true },
      },
      {
        traceId: 'tr-payment-timeout-902',
        spanId: 'span-order-12',
        parentSpanId: 'span-gw-11',
        serviceName: 'order-service',
        name: 'ExecutePaymentCapture',
        startTimeMs: baseTime + 40015,
        durationMs: 2480,
        statusCode: 504,
        attributes: { 'error': true },
      },
      {
        traceId: 'tr-payment-timeout-902',
        spanId: 'span-pay-13',
        parentSpanId: 'span-order-12',
        serviceName: 'payment-gateway',
        name: 'Stripe POST /v1/charges',
        startTimeMs: baseTime + 40030,
        durationMs: 2450,
        statusCode: 504,
        attributes: {
          'error': true,
          'error.type': 'GatewayTimeoutException',
          'http.url': 'https://api.stripe.com/v1/charges',
        },
      },
    ];

    // 3. Healthy Fast Trace: User Profile Lookup
    const trace3Spans: TraceSpan[] = [
      {
        traceId: 'tr-profile-healthy-903',
        spanId: 'span-gw-21',
        serviceName: 'api-gateway',
        name: 'GET /api/v1/users/me',
        startTimeMs: baseTime + 80000,
        durationMs: 42,
        statusCode: 200,
        attributes: { 'http.method': 'GET', 'status': 'ok' },
      },
      {
        traceId: 'tr-profile-healthy-903',
        spanId: 'span-auth-22',
        parentSpanId: 'span-gw-21',
        serviceName: 'auth-service',
        name: 'AuthorizeUserContext',
        startTimeMs: baseTime + 80005,
        durationMs: 14,
        statusCode: 200,
        attributes: { 'user.id': 'usr_9981' },
      },
      {
        traceId: 'tr-profile-healthy-903',
        spanId: 'span-db-23',
        parentSpanId: 'span-gw-21',
        serviceName: 'inventory-db',
        name: 'SELECT profile, preferences FROM users WHERE id = ?',
        startTimeMs: baseTime + 80022,
        durationMs: 18,
        statusCode: 200,
        attributes: { 'db.system': 'postgresql' },
      },
    ];

    this.ingestBatch(trace1Spans);
    this.ingestBatch(trace2Spans);
    this.ingestBatch(trace3Spans);
  }

  public reset(): void {
    this.db.exec('DELETE FROM spans');
    anomalyDetector.reset();
    serviceTopologyAggregator.reset();
    this.seedDefaultTraces();
  }
}

export const traceCollector = new TraceCollector();
