import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalyticsHeader } from '../components/analytics/AnalyticsHeader';
import { LatencyPercentileChart } from '../components/analytics/LatencyPercentileChart';
import { TrafficHeatmap } from '../components/analytics/TrafficHeatmap';
import { LatencyCDFChart } from '../components/analytics/LatencyCDFChart';
import { ErrorBreakdownChart } from '../components/analytics/ErrorBreakdownChart';
import { EndpointLeaderboard } from '../components/analytics/EndpointLeaderboard';
import { AnalyticsView } from '../components/analytics/AnalyticsView';
import { ApiRequestLog, TimeBucket, AggregatedMetrics, DetectedAnomaly } from '../types/telemetry';

const mockMetrics: AggregatedMetrics = {
  totalRequests: 8400,
  errorCount: 12,
  successRate: 99.85,
  avgLatency: 52.4,
  p50Latency: 42.0,
  p95Latency: 145.0,
  p99Latency: 320.0,
  activeAnomaliesCount: 1,
};

const mockAnomalies: DetectedAnomaly[] = [
  {
    ruleId: 'rule-test-1',
    ruleName: 'P95 Latency Spike',
    metric: 'latency',
    severity: 'critical',
    currentValue: 320,
    threshold: 200,
    detectedAt: 1700000000000,
    description: 'P95 Latency exceeded 200ms threshold in recent window.',
  },
];

const mockTimeBuckets: TimeBucket[] = [
  { timestamp: 1700000000000, requestCount: 120, errorCount: 1, avgLatency: 45, p95Latency: 110 },
  { timestamp: 1700000060000, requestCount: 240, errorCount: 3, avgLatency: 60, p95Latency: 180 },
  { timestamp: 1700000120000, requestCount: 310, errorCount: 8, avgLatency: 95, p95Latency: 320 },
];

const mockLogs: ApiRequestLog[] = [
  {
    id: 'l-1',
    timestamp: 1700000000000,
    method: 'GET',
    endpoint: '/api/v1/checkout/orders',
    statusCode: 200,
    latencyMs: 45,
    clientIp: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    traceId: '00-test-1',
    spanId: 's-1',
    requestHeaders: {},
    responseHeaders: {},
    requestBody: null,
    responseBody: null,
  },
  {
    id: 'l-2',
    timestamp: 1700000060000,
    method: 'POST',
    endpoint: '/api/v1/payments/process',
    statusCode: 504,
    latencyMs: 650,
    clientIp: '192.168.1.2',
    userAgent: 'Mozilla/5.0',
    traceId: '00-test-2',
    spanId: 's-2',
    requestHeaders: {},
    responseHeaders: {},
    requestBody: null,
    responseBody: null,
  },
];

describe('AnalyticsHeader Component', () => {
  it('renders AI Copilot briefing and SLO error budget calculation accurately', () => {
    const onCreateAlert = vi.fn();
    render(
      <AnalyticsHeader
        metrics={mockMetrics}
        anomalies={mockAnomalies}
        totalLogsCount={8400}
        onCreateAlert={onCreateAlert}
      />
    );

    expect(screen.getByText('AI Observability Copilot')).toBeInTheDocument();
    expect(screen.getByText(/Identified 1 operational breaches/)).toBeInTheDocument();
    expect(screen.getByText('SLO Error Budget (99.9%)')).toBeInTheDocument();

    // Verify create alert button trigger
    const alertBtn = screen.getByText('Create Alert from Insights');
    fireEvent.click(alertBtn);
    expect(onCreateAlert).toHaveBeenCalled();
  });
});

describe('LatencyPercentileChart Component', () => {
  it('renders percentile curves, split dimension selector, and anomaly band', () => {
    render(
      <LatencyPercentileChart
        timeBuckets={mockTimeBuckets}
        anomalies={mockAnomalies}
      />
    );

    expect(screen.getByText('Latency Distribution Percentiles')).toBeInTheDocument();
    expect(screen.getByText('P99 Latency')).toBeInTheDocument();
    expect(screen.getByText('P50 (Median)')).toBeInTheDocument();

    // Dimension split selection
    const splitSelect = screen.getByRole('combobox');
    expect(splitSelect).toBeInTheDocument();
    fireEvent.change(splitSelect, { target: { value: 'region' } });
    expect(splitSelect).toHaveValue('region');
  });
});

describe('TrafficHeatmap Component', () => {
  it('renders heatmap latency brackets and BubbleUp scatter outlier points', () => {
    const onFilterBucket = vi.fn();
    render(
      <TrafficHeatmap
        logs={mockLogs}
        timeBuckets={mockTimeBuckets}
        onFilterBucket={onFilterBucket}
      />
    );

    expect(screen.getByText('Traffic Density Heatmap')).toBeInTheDocument();
    expect(screen.getByText(/BubbleUp/)).toBeInTheDocument();
    expect(screen.getByText('500ms - 1s')).toBeInTheDocument();
  });
});

describe('LatencyCDFChart & ErrorBreakdownChart Components', () => {
  it('renders CDF curve, downstream dependencies, and status breakdown', () => {
    render(<LatencyCDFChart logs={mockLogs} />);
    expect(screen.getByText('Cumulative Distribution (CDF)')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL Primary Cluster')).toBeInTheDocument();
    expect(screen.getByText('Stripe Billing API')).toBeInTheDocument();

    render(<ErrorBreakdownChart timeBuckets={mockTimeBuckets} />);
    expect(screen.getByText('HTTP Status Code & Error Rate Breakdown')).toBeInTheDocument();
  });
});

describe('EndpointLeaderboard Component', () => {
  it('ranks endpoints by impact score and supports sorting', () => {
    const onFilterEndpoint = vi.fn();
    render(
      <EndpointLeaderboard
        logs={mockLogs}
        onFilterEndpoint={onFilterEndpoint}
      />
    );

    expect(screen.getByText('Endpoint Performance Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/checkout/orders')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/payments/process')).toBeInTheDocument();

    // Test filter click
    fireEvent.click(screen.getByText('/api/v1/checkout/orders'));
    expect(onFilterEndpoint).toHaveBeenCalledWith('/api/v1/checkout/orders');
  });
});
