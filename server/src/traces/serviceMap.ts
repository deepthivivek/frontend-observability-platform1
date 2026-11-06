import { ServiceTopologyNode, ServiceTopologyEdge, ServiceTopologyMapData, TraceSpan } from '../../../src/types/trace';

interface ServiceAgg {
  id: string;
  name: string;
  type: ServiceTopologyNode['type'];
  totalCalls: number;
  totalErrors: number;
  totalDurationMs: number;
}

interface EdgeAgg {
  id: string;
  source: string;
  target: string;
  totalCalls: number;
  totalErrors: number;
  totalDurationMs: number;
}

export class ServiceTopologyMapAggregator {
  private services = new Map<string, ServiceAgg>();
  private edges = new Map<string, EdgeAgg>();

  constructor() {
    this.seedDefaultTopology();
  }

  private seedDefaultTopology() {
    const defaultServices: Array<{ id: string; name: string; type: ServiceTopologyNode['type'] }> = [
      { id: 'api-gateway', name: 'API Gateway (Edge)', type: 'gateway' },
      { id: 'auth-service', name: 'Auth & Session Svc', type: 'service' },
      { id: 'order-service', name: 'Order Processing Svc', type: 'service' },
      { id: 'payment-gateway', name: 'Stripe Merchant Svc', type: 'external' },
      { id: 'inventory-db', name: 'Inventory PostgreSQL', type: 'database' },
      { id: 'redis-cache', name: 'Cluster Redis Cache', type: 'cache' },
    ];

    for (const svc of defaultServices) {
      this.services.set(svc.id, {
        id: svc.id,
        name: svc.name,
        type: svc.type,
        totalCalls: 120,
        totalErrors: svc.id === 'payment-gateway' ? 6 : 1,
        totalDurationMs: svc.id === 'inventory-db' ? 120 * 85 : 120 * 35,
      });
    }

    const defaultEdges = [
      { source: 'api-gateway', target: 'auth-service', calls: 120, errors: 2, dur: 45 },
      { source: 'api-gateway', target: 'order-service', calls: 95, errors: 4, dur: 120 },
      { source: 'auth-service', target: 'redis-cache', calls: 110, errors: 0, dur: 12 },
      { source: 'order-service', target: 'payment-gateway', calls: 60, errors: 5, dur: 340 },
      { source: 'order-service', target: 'inventory-db', calls: 95, errors: 2, dur: 75 },
    ];

    for (const e of defaultEdges) {
      const id = `${e.source}->${e.target}`;
      this.edges.set(id, {
        id,
        source: e.source,
        target: e.target,
        totalCalls: e.calls,
        totalErrors: e.errors,
        totalDurationMs: e.calls * e.dur,
      });
    }
  }

  public recordSpan(span: TraceSpan, parentSpan?: TraceSpan): void {
    const sId = span.serviceName || span.service || 'unknown-service';
    let svc = this.services.get(sId);
    if (!svc) {
      const isDb = sId.toLowerCase().includes('db') || sId.toLowerCase().includes('sql') || sId.toLowerCase().includes('postgres');
      const isCache = sId.toLowerCase().includes('cache') || sId.toLowerCase().includes('redis');
      const isGateway = sId.toLowerCase().includes('gateway');
      const type: ServiceTopologyNode['type'] = isDb ? 'database' : isCache ? 'cache' : isGateway ? 'gateway' : 'service';

      svc = {
        id: sId,
        name: sId,
        type,
        totalCalls: 0,
        totalErrors: 0,
        totalDurationMs: 0,
      };
      this.services.set(sId, svc);
    }

    svc.totalCalls++;
    svc.totalDurationMs += span.durationMs;
    if ((span.statusCode ?? 200) >= 500) {
      svc.totalErrors++;
    }

    // Record edge if parent is from a different service
    const pService = parentSpan?.serviceName || parentSpan?.service;
    if (pService && pService !== sId) {
      const edgeId = `${pService}->${sId}`;
      let edge = this.edges.get(edgeId);
      if (!edge) {
        edge = {
          id: edgeId,
          source: pService,
          target: sId,
          totalCalls: 0,
          totalErrors: 0,
          totalDurationMs: 0,
        };
        this.edges.set(edgeId, edge);
      }
      edge.totalCalls++;
      edge.totalDurationMs += span.durationMs;
      if ((span.statusCode ?? 200) >= 500) {
        edge.totalErrors++;
      }
    }
  }

  public getTopologyData(): ServiceTopologyMapData {
    const nodes: ServiceTopologyNode[] = [];
    for (const s of this.services.values()) {
      const avgLat = s.totalCalls > 0 ? parseFloat((s.totalDurationMs / s.totalCalls).toFixed(1)) : 0;
      const errRate = s.totalCalls > 0 ? parseFloat(((s.totalErrors / s.totalCalls) * 100).toFixed(1)) : 0;
      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (errRate > 5 || avgLat > 400) {
        status = 'critical';
      } else if (errRate > 1 || avgLat > 150) {
        status = 'degraded';
      }

      nodes.push({
        id: s.id,
        name: s.name,
        type: s.type,
        requestCount: s.totalCalls,
        errorRate: errRate,
        avgLatencyMs: avgLat,
        status,
      });
    }

    const edges: ServiceTopologyEdge[] = [];
    for (const e of this.edges.values()) {
      const avgLat = e.totalCalls > 0 ? parseFloat((e.totalDurationMs / e.totalCalls).toFixed(1)) : 0;
      const errRate = e.totalCalls > 0 ? parseFloat(((e.totalErrors / e.totalCalls) * 100).toFixed(1)) : 0;
      const isDegraded = errRate > 3 || avgLat > 250;

      edges.push({
        id: e.id,
        source: e.source,
        target: e.target,
        callCount: e.totalCalls,
        avgLatencyMs: avgLat,
        errorRate: errRate,
        isDegraded,
      });
    }

    return {
      nodes,
      edges,
      timestamp: Date.now(),
    };
  }

  public reset(): void {
    this.services.clear();
    this.edges.clear();
    this.seedDefaultTopology();
  }
}

export const serviceTopologyAggregator = new ServiceTopologyMapAggregator();
