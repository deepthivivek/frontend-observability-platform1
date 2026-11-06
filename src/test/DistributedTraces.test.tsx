import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TraceWaterfall } from '../components/traces/TraceWaterfall';
import { ServiceTopologyMap } from '../components/traces/ServiceTopologyMap';
import { TraceExplorerView } from '../components/traces/TraceExplorerView';
import { TraceTree, ServiceTopologyMapData } from '../types/trace';

const mockTraceTree: TraceTree = {
  traceId: 'tr-test-101',
  spansCount: 3,
  totalDurationMs: 450,
  hasAnomalies: true,
  hasErrors: false,
  services: ['api-gateway', 'order-service', 'inventory-db'],
  timestamp: 1700000000000,
  rootCause: {
    bottleneckSpanId: 'span-db-99',
    serviceName: 'inventory-db',
    reason: 'Lock timeout waiting on postgres connection pool',
    remediation: 'Expand connection pool limits',
  },
  rootSpan: {
    traceId: 'tr-test-101',
    spanId: 'span-root-1',
    serviceName: 'api-gateway',
    name: 'POST /v1/checkout',
    startTimeMs: 1700000000000,
    durationMs: 450,
    statusCode: 200,
    attributes: { 'http.method': 'POST' },
    depth: 0,
    offsetMs: 0,
    children: [
      {
        traceId: 'tr-test-101',
        spanId: 'span-order-2',
        parentSpanId: 'span-root-1',
        serviceName: 'order-service',
        name: 'ProcessOrder',
        startTimeMs: 1700000000020,
        durationMs: 420,
        statusCode: 200,
        attributes: {},
        depth: 1,
        offsetMs: 20,
        children: [
          {
            traceId: 'tr-test-101',
            spanId: 'span-db-99',
            parentSpanId: 'span-order-2',
            serviceName: 'inventory-db',
            name: 'SELECT * FROM inventory',
            startTimeMs: 1700000000050,
            durationMs: 380,
            statusCode: 200,
            isAnomaly: true,
            zScore: 4.2,
            attributes: { 'db.system': 'postgresql' },
            depth: 2,
            offsetMs: 50,
            children: [],
          },
        ],
      },
    ],
  },
};

const mockTopologyData: ServiceTopologyMapData = {
  timestamp: Date.now(),
  nodes: [
    {
      id: 'api-gateway',
      name: 'API Gateway (Edge)',
      type: 'gateway',
      requestCount: 150,
      errorRate: 0.5,
      avgLatencyMs: 45,
      status: 'healthy',
    },
    {
      id: 'inventory-db',
      name: 'Inventory PostgreSQL',
      type: 'database',
      requestCount: 90,
      errorRate: 4.5,
      avgLatencyMs: 320,
      status: 'degraded',
    },
  ],
  edges: [
    {
      id: 'api-gateway->inventory-db',
      source: 'api-gateway',
      target: 'inventory-db',
      callCount: 90,
      avgLatencyMs: 320,
      errorRate: 4.5,
      isDegraded: true,
    },
  ],
};

describe('Distributed Tracing & Service Mesh Suite (Day 12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/topology')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTopologyData),
        });
      }
      if (url.includes('/api/v1/traces/tr-test-101')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTraceTree),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          {
            traceId: 'tr-test-101',
            rootServiceName: 'api-gateway',
            rootSpanName: 'POST /v1/checkout',
            totalDurationMs: 450,
            spanCount: 3,
            hasError: false,
            hasAnomaly: true,
            maxZScore: 4.2,
            startTimeMs: Date.now() - 5000,
            services: ['api-gateway', 'order-service', 'inventory-db'],
          },
        ]),
      });
    }) as unknown as typeof fetch;
  });

  describe('TraceWaterfall Component', () => {
    it('renders trace header, root-cause insight banner, and hierarchical spans', () => {
      render(<TraceWaterfall trace={mockTraceTree} onClose={vi.fn()} />);

      expect(screen.getByText('tr-test-101')).toBeInTheDocument();
      expect(screen.getByText('Z-SCORE ANOMALY')).toBeInTheDocument();
      expect(screen.getByText(/Lock timeout waiting on postgres/i)).toBeInTheDocument();
      expect(screen.getByText('Expand connection pool limits')).toBeInTheDocument();
      expect(screen.getAllByText('POST /v1/checkout').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('ProcessOrder')).toBeInTheDocument();
    });

    it('displays span details in inspector drawer when a span is clicked', () => {
      render(<TraceWaterfall trace={mockTraceTree} />);

      const dbSpan = screen.getByText('SELECT * FROM inventory');
      fireEvent.click(dbSpan);

      expect(screen.getByText('4.2σ')).toBeInTheDocument();
      expect(screen.getAllByText('inventory-db').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ServiceTopologyMap Component', () => {
    it('renders microservice node cards and dependency edge matrix', () => {
      render(<ServiceTopologyMap topology={mockTopologyData} onRefresh={vi.fn()} />);

      expect(screen.getByText('API Gateway (Edge)')).toBeInTheDocument();
      expect(screen.getByText('Inventory PostgreSQL')).toBeInTheDocument();
      expect(screen.getByText('DEGRADED')).toBeInTheDocument();
      expect(screen.getByText('DEGRADED EDGE')).toBeInTheDocument();
    });
  });

  describe('TraceExplorerView Component', () => {
    it('renders tab switcher and toggles between Waterfalls and Service Topology Map', async () => {
      render(<TraceExplorerView />);

      expect(screen.getByText('Distributed Traces & Service Mesh')).toBeInTheDocument();
      expect(screen.getByText('Trace Waterfalls')).toBeInTheDocument();
      expect(screen.getByText('Service Topology')).toBeInTheDocument();

      // Click Service Topology tab
      const topologyTab = screen.getByRole('button', { name: /Service Topology/i });
      fireEvent.click(topologyTab);

      await waitFor(() => {
        expect(screen.getByText('Dynamic Service Topology Map')).toBeInTheDocument();
      });
    });
  });
});
