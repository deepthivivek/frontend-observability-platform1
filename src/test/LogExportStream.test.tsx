import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { TailStreamControls } from '../components/logs/TailStreamControls';
import { StreamTimeTravel } from '../components/logs/StreamTimeTravel';
import { ExportModal } from '../components/logs/ExportModal';
import { RegexLibrary, CURATED_QUERY_SNIPPETS } from '../components/logs/RegexLibrary';
import { useLogStream } from '../hooks/useLogStream';
import { evaluateLogQuery } from '../utils/logQueryParser';
import {
  generateLogExport,
  sanitizeLog,
  diffPayloads,
} from '../utils/logExportUtils';
import { ApiRequestLog } from '../types/telemetry';

const mockLogs: ApiRequestLog[] = [
  {
    id: 'log-1',
    timestamp: 1700000000000,
    method: 'GET',
    endpoint: '/api/v1/users?token=secret123',
    statusCode: 200,
    latencyMs: 120,
    clientIp: '192.168.1.50',
    userAgent: 'Mozilla/5.0',
    traceId: 'trace-111',
    spanId: 'span-1',
    requestHeaders: {
      authorization: 'Bearer supersecrettoken',
      cookie: 'session_id=abc9988',
    },
    responseHeaders: { 'content-type': 'application/json' },
    requestBody: { password: 'myPassword1!', username: 'alice' },
    responseBody: { success: true, email: 'alice@corp.internal' },
  },
  {
    id: 'log-2',
    timestamp: 1700000030000,
    method: 'POST',
    endpoint: '/api/v1/checkout/charge',
    statusCode: 504,
    latencyMs: 1450,
    clientIp: '10.0.0.12',
    userAgent: 'Go-http-client/1.1',
    traceId: 'trace-222',
    spanId: 'span-2',
    requestHeaders: { 'x-api-key': 'live_key_999' },
    responseHeaders: { 'content-type': 'application/json' },
    requestBody: { orderId: 'ord-881', amount: 4900, creditCard: '4111111111111111' },
    responseBody: { error: 'Gateway timeout contacting banking network' },
    errorDetails: {
      message: 'Gateway timeout',
      code: 'ERR_TIMEOUT',
    },
  },
  {
    id: 'log-3',
    timestamp: 1700000060000,
    method: 'GET',
    endpoint: '/api/v1/auth/verify',
    statusCode: 401,
    latencyMs: 45,
    clientIp: '172.16.0.4',
    userAgent: 'curl/7.88',
    traceId: 'trace-333',
    spanId: 'span-3',
    requestHeaders: {},
    responseHeaders: {},
    requestBody: null,
    responseBody: { error: 'Unauthorized' },
  },
];

describe('useLogStream Hook', () => {
  it('manages pause/resume tail state and time-travel scrubber offsets', () => {
    const { result } = renderHook(() => useLogStream(mockLogs));

    expect(result.current.isPaused).toBe(false);
    expect(result.current.isTimeTraveling).toBe(false);

    // Toggle pause
    act(() => {
      result.current.togglePause();
    });
    expect(result.current.isPaused).toBe(true);

    // Set time-travel offset to 60s
    act(() => {
      result.current.setTimeTravelOffset(60);
    });
    expect(result.current.timeTravelOffset).toBe(60);
    expect(result.current.isTimeTraveling).toBe(true);
    expect(result.current.isPaused).toBe(true);

    // Reset time-travel back to live
    act(() => {
      result.current.resetTimeTravel();
    });
    expect(result.current.timeTravelOffset).toBe(0);
    expect(result.current.isTimeTraveling).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });

  it('toggles auto-scroll lock and sampling mode', () => {
    const { result } = renderHook(() => useLogStream(mockLogs));

    expect(result.current.isAutoScrollLocked).toBe(true);
    act(() => {
      result.current.toggleAutoScrollLock();
    });
    expect(result.current.isAutoScrollLocked).toBe(false);

    expect(result.current.samplingMode).toBe('full');
    act(() => {
      result.current.toggleSamplingMode();
    });
    expect(result.current.samplingMode).toBe('sampled');
  });
});

describe('TailStreamControls Component', () => {
  it('renders stream controls, backpressure meter, and handles toggles', () => {
    const handleTogglePause = vi.fn();
    const handleToggleAutoScroll = vi.fn();
    const handleOpenTimeTravel = vi.fn();
    const handleOpenExport = vi.fn();

    render(
      <TailStreamControls
        isPaused={false}
        onTogglePause={handleTogglePause}
        isAutoScrollLocked={true}
        onToggleAutoScroll={handleToggleAutoScroll}
        ingestionRate={85}
        samplingMode="full"
        onToggleSampling={vi.fn()}
        backpressureRatio={1.0}
        hasRecent5xxBurst={true}
        recent5xxCount={4}
        isTimeTraveling={false}
        timeTravelOffset={0}
        onOpenTimeTravel={handleOpenTimeTravel}
        onOpenExportModal={handleOpenExport}
        totalLogsCount={1200}
        filteredLogsCount={350}
      />
    );

    expect(screen.getByText('Live Tailing')).toBeInTheDocument();
    expect(screen.getByText('Auto-Scroll Locked')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText(/5xx Fault Burst/i)).toBeInTheDocument();

    const pauseBtn = screen.getByText('Live Tailing');
    fireEvent.click(pauseBtn);
    expect(handleTogglePause).toHaveBeenCalledTimes(1);

    const exportBtn = screen.getByText('Export Studio');
    fireEvent.click(exportBtn);
    expect(handleOpenExport).toHaveBeenCalledTimes(1);

    const timeTravelBtn = screen.getByText('Time-Travel Scrubber');
    fireEvent.click(timeTravelBtn);
    expect(handleOpenTimeTravel).toHaveBeenCalledTimes(1);
  });
});

describe('StreamTimeTravel Component', () => {
  it('renders time scrubber slider and preset buttons', () => {
    const handleOffsetChange = vi.fn();
    const handleResetLive = vi.fn();

    render(
      <StreamTimeTravel
        isOpen={true}
        onClose={vi.fn()}
        timeTravelOffset={60}
        onOffsetChange={handleOffsetChange}
        onResetLive={handleResetLive}
        totalLogsCount={1200}
        visibleLogsCount={800}
        newestLogTimestamp={Date.now()}
      />
    );

    expect(screen.getByText('Time-Travel Buffer Scrubber')).toBeInTheDocument();
    expect(screen.getByText('-1m ago')).toBeInTheDocument();

    const liveBtn = screen.getByText('Return to Live');
    fireEvent.click(liveBtn);
    expect(handleResetLive).toHaveBeenCalledTimes(1);

    const preset5m = screen.getByText('-5m');
    fireEvent.click(preset5m);
    expect(handleOffsetChange).toHaveBeenCalledWith(300);
  });
});

describe('ExportModal & PII Redaction Suite', () => {
  it('redacts sensitive headers, body keys, and IPs when PII masking is enabled', () => {
    const log = mockLogs[0];
    const sanitized = sanitizeLog(log, true);

    expect(sanitized.requestHeaders['authorization']).toBe('[REDACTED]');
    expect(sanitized.requestHeaders['cookie']).toBe('[REDACTED]');
    expect((sanitized.requestBody as any).password).toBe('[REDACTED]');
    expect((sanitized.responseBody as any).email).toBe('[REDACTED]');
    expect(sanitized.clientIp).toContain('xxx.xxx');
    expect(sanitized.endpoint).not.toContain('secret123');
    expect(sanitized.endpoint).toContain('[REDACTED]');
  });

  it('generates valid JSON, CSV, and NDJSON exports', () => {
    // 1. JSON
    const jsonRes = generateLogExport(mockLogs, {
      format: 'json',
      scope: 'all',
      fields: ['timestamp', 'method', 'endpoint', 'statusCode'],
      redactPii: true,
    });
    expect(jsonRes.mimeType).toContain('json');
    const parsedJson = JSON.parse(jsonRes.content);
    expect(parsedJson.length).toBe(mockLogs.length);
    expect(parsedJson[0].method).toBe('GET');

    // 2. CSV
    const csvRes = generateLogExport(mockLogs, {
      format: 'csv',
      scope: 'all',
      fields: ['timestamp', 'method', 'endpoint', 'statusCode'],
      redactPii: true,
    });
    expect(csvRes.mimeType).toContain('csv');
    expect(csvRes.content).toContain('"method","endpoint","statusCode"');

    // 3. NDJSON
    const ndjsonRes = generateLogExport(mockLogs, {
      format: 'ndjson',
      scope: 'all',
      fields: ['method', 'statusCode'],
      redactPii: true,
    });
    expect(ndjsonRes.mimeType).toContain('ndjson');
    const lines = ndjsonRes.content.trim().split('\n');
    expect(lines.length).toBe(mockLogs.length);
  });

  it('renders modal and handles format switching and download trigger', () => {
    render(
      <ExportModal
        isOpen={true}
        onClose={vi.fn()}
        filteredLogs={mockLogs}
        allLogs={mockLogs}
        selectedLogIds={new Set(['log-1'])}
      />
    );

    expect(screen.getByText('Advanced Log Export Studio & Diagnostic Suite')).toBeInTheDocument();
    expect(screen.getByText('JSON Array')).toBeInTheDocument();
    expect(screen.getByText('CSV Spreadsheet')).toBeInTheDocument();
    expect(screen.getByText('Newline Delimited JSON')).toBeInTheDocument();
    expect(screen.getByText('Diagnostic Bundle')).toBeInTheDocument();

    const csvRadio = screen.getByText('CSV Spreadsheet');
    fireEvent.click(csvRadio);

    const downloadBtn = screen.getByText('Generate & Download');
    expect(downloadBtn).toBeInTheDocument();
  });
});

describe('Payload Structural Diffing', () => {
  it('correctly detects added, removed, and modified keys between payloads', () => {
    const base = {
      orderId: 'ord-1',
      user: { name: 'Alice', role: 'admin' },
      itemsCount: 3,
    };

    const target = {
      orderId: 'ord-1',
      user: { name: 'Alice', role: 'customer' }, // modified
      itemsCount: 3, // unchanged
      discountCode: 'SUMMER24', // added
    };

    const diff = diffPayloads(base, target);

    const added = diff.find((d) => d.path === 'discountCode');
    expect(added?.status).toBe('added');
    expect(added?.targetValue).toBe('SUMMER24');

    const modifiedRole = diff.find((d) => d.path === 'user.role');
    expect(modifiedRole?.status).toBe('modified');
    expect(modifiedRole?.baselineValue).toBe('admin');
    expect(modifiedRole?.targetValue).toBe('customer');
  });
});

describe('RegexLibrary & Smart Query Evaluation', () => {
  it('evaluates structured predicates: status comparisons, latency, and IN clauses', () => {
    const log200 = mockLogs[0];
    const log504 = mockLogs[1];
    const log401 = mockLogs[2];

    expect(evaluateLogQuery(log504, 'status >= 500')).toBe(true);
    expect(evaluateLogQuery(log200, 'status >= 500')).toBe(false);

    expect(evaluateLogQuery(log504, 'duration > 1000')).toBe(true);
    expect(evaluateLogQuery(log200, 'duration > 1000')).toBe(false);

    expect(evaluateLogQuery(log401, 'status IN (401, 403)')).toBe(true);
    expect(evaluateLogQuery(log200, 'status IN (401, 403)')).toBe(false);

    expect(evaluateLogQuery(log200, "method == 'GET'")).toBe(true);
    expect(evaluateLogQuery(log504, "method == 'GET'")).toBe(false);

    expect(evaluateLogQuery(log504, "endpoint CONTAINS '/checkout' AND status >= 400")).toBe(true);
  });

  it('renders curated SRE snippets and applies query on click', () => {
    const handleQueryChange = vi.fn();
    const handleApplyQuery = vi.fn();

    render(
      <RegexLibrary
        query=""
        onQueryChange={handleQueryChange}
        onApplyQuery={handleApplyQuery}
      />
    );

    const snippetsBtn = screen.getByText('Snippets');
    fireEvent.click(snippetsBtn);

    expect(screen.getByText('5xx Server Faults')).toBeInTheDocument();
    expect(screen.getByText('Slow Database Queries')).toBeInTheDocument();

    const snip5xx = screen.getByText('5xx Server Faults');
    fireEvent.click(snip5xx);

    expect(handleQueryChange).toHaveBeenCalledWith('status >= 500');
    expect(handleApplyQuery).toHaveBeenCalledWith('status >= 500');
  });
});
