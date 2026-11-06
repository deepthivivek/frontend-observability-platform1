import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogInspectorDrawer } from '../components/inspector/LogInspectorDrawer';
import { TraceWaterfall } from '../components/inspector/TraceWaterfall';
import { AITriagePanel } from '../components/inspector/AITriagePanel';
import { PayloadViewer } from '../components/inspector/PayloadViewer';
import { ApiRequestLog } from '../types/telemetry';

const mockLog: ApiRequestLog = {
  id: 'log-inspector-test',
  timestamp: 1700000000000,
  method: 'POST',
  endpoint: '/api/v1/checkout/orders',
  statusCode: 504,
  latencyMs: 780,
  clientIp: '192.168.1.100',
  userAgent: 'Mozilla/5.0 Inspector Test',
  traceId: '00-inspector123456789-01',
  spanId: 'span-root-99',
  requestHeaders: {
    authorization: 'Bearer secret_jwt',
    'content-type': 'application/json',
  },
  responseHeaders: {
    'content-type': 'application/json',
  },
  requestBody: { orderId: 'ord_99' },
  responseBody: { error: 'Gateway timeout' },
  errorDetails: {
    message: 'Postgres Connection Timeout',
    stack: 'Error: timeout at Pool.acquire()',
  },
};

const mockAdjacentLogs: ApiRequestLog[] = [
  mockLog,
  {
    ...mockLog,
    id: 'log-adjacent-2',
    timestamp: 1700000002000,
    statusCode: 200,
    latencyMs: 40,
  },
];

describe('LogInspectorDrawer Component', () => {
  it('opens and displays log method, endpoint, status, and permalink button', () => {
    const onClose = vi.fn();

    render(
      <LogInspectorDrawer
        log={mockLog}
        onClose={onClose}
        onNextLog={vi.fn()}
        onPrevLog={vi.fn()}
        surroundingLogs={mockAdjacentLogs}
      />
    );

    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/checkout/orders')).toBeInTheDocument();
    expect(screen.getByText('504')).toBeInTheDocument();
    expect(screen.getByText('Share Trace')).toBeInTheDocument();
    expect(screen.getByText('Export Bundle')).toBeInTheDocument();
    expect(screen.getByText('Replay Request')).toBeInTheDocument();
  });

  it('switches tabs across Waterfall, Custom Tags, Context Logs, Payloads, REPL, and Notes', () => {
    render(
      <PayloadViewer
        log={mockLog}
        surroundingLogs={mockAdjacentLogs}
        onFilterTag={vi.fn()}
        onFilterEndpoint={vi.fn()}
      />
    );

    // Default tab is Trace Waterfall
    expect(screen.getByText('AI Root Cause Diagnostics')).toBeInTheDocument();

    // Click Custom Tags Tab
    fireEvent.click(screen.getByText('Custom Tags'));
    expect(screen.getByText('tenant_id')).toBeInTheDocument();
    expect(screen.getByText('enterprise_alpha_92')).toBeInTheDocument();

    // Click Context Logs Tab
    fireEvent.click(screen.getByText('Context Logs'));
    expect(screen.getByText(/Showing requests within ±5 seconds/)).toBeInTheDocument();

    // Click Payloads Tab
    fireEvent.click(screen.getByText('Payloads & Headers'));
    expect(screen.getByText('Request Headers')).toBeInTheDocument();

    // Click Micro-REPL Tab
    fireEvent.click(screen.getByText('Micro-REPL'));
    expect(screen.getByText('Run Query')).toBeInTheDocument();

    // Click Incident Notes Tab
    fireEvent.click(screen.getByText('Incident Notes'));
    expect(screen.getByPlaceholderText('Add an incident note or hypothesis...')).toBeInTheDocument();
  });

  it('navigates through logs with J and K keyboard shortcuts and closes with Esc', () => {
    const onNextLog = vi.fn();
    const onPrevLog = vi.fn();
    const onClose = vi.fn();

    render(
      <LogInspectorDrawer
        log={mockLog}
        onClose={onClose}
        onNextLog={onNextLog}
        onPrevLog={onPrevLog}
      />
    );

    // Press 'J' for Next Log
    fireEvent.keyDown(window, { key: 'j' });
    expect(onNextLog).toHaveBeenCalled();

    // Press 'K' for Prev Log
    fireEvent.keyDown(window, { key: 'k' });
    expect(onPrevLog).toHaveBeenCalled();

    // Press 'Escape' to close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles trace view modes: Waterfall, Flamegraph, and Diff vs Baseline', () => {
    render(<TraceWaterfall log={mockLog} />);

    expect(screen.getByText('Waterfall')).toBeInTheDocument();
    expect(screen.getByText('Flamegraph')).toBeInTheDocument();
    expect(screen.getByText('Diff vs Baseline')).toBeInTheDocument();

    // Switch to Flamegraph
    fireEvent.click(screen.getByText('Flamegraph'));
    expect(screen.getByText(/Interactive Call Hierarchy/)).toBeInTheDocument();

    // Switch to Diff
    fireEvent.click(screen.getByText('Diff vs Baseline'));
    expect(screen.getByText(/healthy median baseline/)).toBeInTheDocument();
  });
});
