import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequestLogTable } from '../components/logs/RequestLogTable';
import { LogTableContainer } from '../components/logs/LogTableContainer';
import { ContextMenu } from '../components/logs/ContextMenu';
import { ApiRequestLog, TimeBucket } from '../types/telemetry';

const mockLogs: ApiRequestLog[] = [
  {
    id: 'log-1',
    timestamp: 1700000000000,
    method: 'GET',
    endpoint: '/api/v1/checkout/orders',
    statusCode: 200,
    latencyMs: 45,
    clientIp: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    traceId: '00-abcdef1234567890-01',
    spanId: 'span-1',
    requestHeaders: { host: 'api.io' },
    responseHeaders: { 'content-type': 'application/json' },
    requestBody: null,
    responseBody: { ok: true },
  },
  {
    id: 'log-2',
    timestamp: 1700000060000,
    method: 'POST',
    endpoint: '/api/v1/payments/process',
    statusCode: 500,
    latencyMs: 650,
    clientIp: '192.168.1.2',
    userAgent: 'Mozilla/5.0',
    traceId: '00-9876543210fedcba-02',
    spanId: 'span-2',
    requestHeaders: { authorization: 'Bearer token' },
    responseHeaders: { 'content-type': 'application/json' },
    requestBody: { amount: 100 },
    responseBody: { error: 'Payment gateway timeout' },
    errorDetails: {
      message: 'Gateway Timeout Exception',
      stack: 'Error: Gateway Timeout\n  at processPayment',
    },
  },
];

const mockBuckets: TimeBucket[] = [
  { timestamp: 1700000000000, requestCount: 1, errorCount: 0, avgLatency: 45, p95Latency: 45 },
  { timestamp: 1700000060000, requestCount: 1, errorCount: 1, avgLatency: 650, p95Latency: 650 },
];

describe('RequestLogTable Component', () => {
  it('renders log rows with correct methods, endpoints, and status badges', () => {
    const onSort = vi.fn();
    const onMethodClick = vi.fn();
    const onStatusClick = vi.fn();

    render(
      <RequestLogTable
        logs={mockLogs}
        totalLogsCount={2}
        timeBuckets={mockBuckets}
        density="comfortable"
        sortConfig={{ field: 'timestamp', direction: 'desc' }}
        onSort={onSort}
        onRowContextMenu={vi.fn()}
        onMethodClick={onMethodClick}
        onStatusClick={onStatusClick}
        selectedLogIds={new Set()}
        onToggleSelectRow={vi.fn()}
        onToggleSelectAll={vi.fn()}
        isAutoTailActive={true}
        onResumeAutoTail={vi.fn()}
      />
    );

    expect(screen.getByText('/api/v1/checkout/orders')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/payments/process')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('expands row to display raw JSON payload accordion on click', () => {
    render(
      <RequestLogTable
        logs={mockLogs}
        totalLogsCount={2}
        timeBuckets={mockBuckets}
        density="comfortable"
        sortConfig={{ field: 'timestamp', direction: 'desc' }}
        onSort={vi.fn()}
        onRowContextMenu={vi.fn()}
        onMethodClick={vi.fn()}
        onStatusClick={vi.fn()}
        selectedLogIds={new Set()}
        onToggleSelectRow={vi.fn()}
        onToggleSelectAll={vi.fn()}
        isAutoTailActive={true}
        onResumeAutoTail={vi.fn()}
      />
    );

    // Click row to toggle expansion
    const row = screen.getByText('/api/v1/payments/process');
    fireEvent.click(row);

    // Verifies JSON inspection accordion appeared
    expect(screen.getByText('Request Headers')).toBeInTheDocument();
    expect(screen.getByText('Error Diagnostics')).toBeInTheDocument();
    expect(screen.getByText(/Gateway Timeout Exception/)).toBeInTheDocument();
  });
});

describe('ContextMenu Component', () => {
  it('renders actions and triggers cURL copy and filter selection', () => {
    const onCopyCurl = vi.fn();
    const onFilterEndpoint = vi.fn();
    const onClose = vi.fn();

    render(
      <ContextMenu
        position={{ x: 100, y: 100, log: mockLogs[0] }}
        onClose={onClose}
        onInspect={vi.fn()}
        onCopyCurl={onCopyCurl}
        onFilterEndpoint={onFilterEndpoint}
        onExcludeStatus={vi.fn()}
        onCopyTraceId={vi.fn()}
      />
    );

    expect(screen.getByText('Copy as cURL')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Copy as cURL'));
    expect(onCopyCurl).toHaveBeenCalledWith(mockLogs[0]);

    fireEvent.click(screen.getByText('Filter by this Endpoint'));
    expect(onFilterEndpoint).toHaveBeenCalledWith(mockLogs[0].endpoint);
  });
});

describe('LogTableContainer Component', () => {
  it('renders smart empty state and triggers burst synthetic injection', () => {
    const onInjectBurst = vi.fn();

    render(
      <LogTableContainer
        logs={[]}
        totalLogsCount={0}
        timeBuckets={[]}
        density="comfortable"
        onFilterChange={vi.fn()}
        onInjectBurst={onInjectBurst}
        onExportLogs={vi.fn()}
        isStreaming={false}
      />
    );

    expect(screen.getByText('No Matching Telemetry Logs')).toBeInTheDocument();
    const burstButton = screen.getByText('Inject Synthetic Test Burst (+2,000 requests)');
    expect(burstButton).toBeInTheDocument();

    fireEvent.click(burstButton);
    expect(onInjectBurst).toHaveBeenCalledWith(2000);
  });
});
