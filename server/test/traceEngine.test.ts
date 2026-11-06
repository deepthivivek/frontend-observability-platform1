import { describe, it, expect, beforeEach } from 'vitest';
import { RollingZScoreAnomalyDetector } from '../src/traces/anomalyDetector';
import { RootCauseAnalyzer } from '../src/traces/rootCauseAnalyzer';
import { ServiceTopologyMapAggregator } from '../src/traces/serviceMap';
import { TraceCollector } from '../src/traces/collector';
import { TraceSpan } from '../../src/types/trace';

describe('Distributed Tracing Backend Engine (Day 12)', () => {
  describe('Rolling Z-Score Anomaly Engine', () => {
    it('accurately calculates mean, standard deviation, and flags outliers >= 3.5σ', () => {
      const detector = new RollingZScoreAnomalyDetector(3.5, 50);

      // Seed 25 baseline points around 50ms with tight variance
      for (let i = 0; i < 25; i++) {
        const val = 50 + (i % 3) * 2; // 50, 52, 54
        const res = detector.recordAndEvaluate('order-service', 'checkout', val);
        expect(res.isAnomaly).toBe(false);
      }

      // Outlier with huge latency surge (e.g. 500ms when mean is ~52ms, stdDev ~2ms)
      const surge = detector.recordAndEvaluate('order-service', 'checkout', 500);
      expect(surge.isAnomaly).toBe(true);
      expect(surge.zScore).toBeGreaterThanOrEqual(3.5);
    });
  });

  describe('Automated Root-Cause Attribution Analyzer', () => {
    const analyzer = new RootCauseAnalyzer();

    it('traces cascading 5xx failures down to originating leaf service', () => {
      const spans: TraceSpan[] = [
        {
          traceId: 'tr-fail-1',
          spanId: 's-root',
          serviceName: 'api-gateway',
          name: 'POST /checkout',
          startTimeMs: 1000,
          durationMs: 800,
          statusCode: 504,
          attributes: { error: true },
        },
        {
          traceId: 'tr-fail-1',
          spanId: 's-order',
          parentSpanId: 's-root',
          serviceName: 'order-service',
          name: 'ProcessPayment',
          startTimeMs: 1050,
          durationMs: 750,
          statusCode: 504,
          attributes: { error: true },
        },
        {
          traceId: 'tr-fail-1',
          spanId: 's-pay-leaf',
          parentSpanId: 's-order',
          serviceName: 'payment-gateway',
          name: 'Stripe POST /charges',
          startTimeMs: 1100,
          durationMs: 700,
          statusCode: 504,
          attributes: { error: true, 'error.type': 'GatewayTimeout' },
        },
      ];

      const insight = analyzer.analyzeTrace(spans);
      expect(insight).not.toBeNull();
      expect(insight?.serviceName).toBe('payment-gateway');
      expect(insight?.bottleneckSpanId).toBe('s-pay-leaf');
      expect(insight?.reason).toContain('timeout');
      expect(insight?.remediation).toBeDefined();
    });

    it('identifies Z-score latency bottlenecks even when status code is 200 OK', () => {
      const spans: TraceSpan[] = [
        {
          traceId: 'tr-latency-1',
          spanId: 's-root',
          serviceName: 'api-gateway',
          name: 'GET /items',
          startTimeMs: 1000,
          durationMs: 1200,
          statusCode: 200,
          attributes: {},
        },
        {
          traceId: 'tr-latency-1',
          spanId: 's-db',
          parentSpanId: 's-root',
          serviceName: 'inventory-db',
          name: 'SELECT * FROM items',
          startTimeMs: 1050,
          durationMs: 1120,
          statusCode: 200,
          isAnomaly: true,
          zScore: 4.5,
          attributes: { 'db.statement': 'SELECT * FROM items' },
        },
      ];

      const insight = analyzer.analyzeTrace(spans);
      expect(insight).not.toBeNull();
      expect(insight?.serviceName).toBe('inventory-db');
      expect(insight?.reason).toContain('Statistical latency anomaly');
    });
  });

  describe('Service Topology Map Aggregator', () => {
    it('records spans and builds cross-service dependency edges', () => {
      const aggregator = new ServiceTopologyMapAggregator();
      aggregator.reset();

      const span1: TraceSpan = {
        traceId: 'tr-test',
        spanId: 'sp-1',
        serviceName: 'custom-gateway',
        name: 'GET /test',
        startTimeMs: 1000,
        durationMs: 50,
        statusCode: 200,
        attributes: {},
      };

      const span2: TraceSpan = {
        traceId: 'tr-test',
        spanId: 'sp-2',
        parentSpanId: 'sp-1',
        serviceName: 'custom-backend',
        name: 'DoWork',
        startTimeMs: 1010,
        durationMs: 30,
        statusCode: 200,
        attributes: {},
      };

      aggregator.recordSpan(span1);
      aggregator.recordSpan(span2, span1);

      const topo = aggregator.getTopologyData();
      expect(topo.nodes.some((n) => n.id === 'custom-gateway')).toBe(true);
      expect(topo.nodes.some((n) => n.id === 'custom-backend')).toBe(true);
      expect(topo.edges.some((e) => e.source === 'custom-gateway' && e.target === 'custom-backend')).toBe(true);
    });
  });

  describe('Distributed Trace Collector (SQLite tree indexer)', () => {
    let collector: TraceCollector;

    beforeEach(() => {
      collector = new TraceCollector(':memory:');
    });

    it('indexes parent-child spans and reconstructs hierarchical execution tree', () => {
      const testTraceId = 'tr-custom-tree-01';
      const spans: TraceSpan[] = [
        {
          traceId: testTraceId,
          spanId: 'sp-root',
          serviceName: 'api-gateway',
          name: 'POST /v1/action',
          startTimeMs: 5000,
          durationMs: 100,
          statusCode: 200,
          attributes: { tag: 'root' },
        },
        {
          traceId: testTraceId,
          spanId: 'sp-child-1',
          parentSpanId: 'sp-root',
          serviceName: 'service-a',
          name: 'Step1',
          startTimeMs: 5010,
          durationMs: 40,
          statusCode: 200,
          attributes: {},
        },
        {
          traceId: testTraceId,
          spanId: 'sp-child-2',
          parentSpanId: 'sp-root',
          serviceName: 'service-b',
          name: 'Step2',
          startTimeMs: 5055,
          durationMs: 35,
          statusCode: 200,
          attributes: {},
        },
      ];

      collector.ingestBatch(spans);

      const tree = collector.getTraceById(testTraceId);
      expect(tree).not.toBeNull();
      expect(tree?.traceId).toBe(testTraceId);
      expect(tree?.rootSpan.spanId).toBe('sp-root');
      expect(tree?.rootSpan.children.length).toBe(2);
      expect(tree?.rootSpan.children[0].depth).toBe(1);
      expect(tree?.rootSpan.children[1].offsetMs).toBe(55);
    });

    it('filters traces by serviceName and minimum duration', () => {
      const all = collector.getTraces();
      expect(all.length).toBeGreaterThan(0);

      const filtered = collector.getTraces({ minDurationMs: 500 });
      for (const t of filtered) {
        expect(t.totalDurationMs).toBeGreaterThanOrEqual(500);
      }
    });
  });
});
