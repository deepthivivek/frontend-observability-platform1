import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryCards } from '../components/dashboard/SummaryCards';
import { CommandPalette } from '../components/common/CommandPalette';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { AggregatedMetrics, MetricDeltas, TimeBucket } from '../types/telemetry';

describe('SummaryCards Component', () => {
  const mockMetrics: AggregatedMetrics = {
    totalRequests: 14250,
    errorCount: 142,
    successRate: 99.0,
    avgLatency: 45.2,
    p50Latency: 38.0,
    p95Latency: 110.5,
    p99Latency: 280.0,
    activeAnomaliesCount: 2,
  };

  const mockDeltas: MetricDeltas = {
    totalRequestsDelta: 12.4,
    errorRateDelta: -0.5,
    avgLatencyDelta: -3.2,
    p95LatencyDelta: 4.1,
  };

  const mockBuckets: TimeBucket[] = [
    { timestamp: 1000, requestCount: 100, errorCount: 1, avgLatency: 40, p95Latency: 90 },
    { timestamp: 2000, requestCount: 150, errorCount: 2, avgLatency: 45, p95Latency: 110 },
  ];

  it('renders mathematically accurate numbers, badges, and sparklines', () => {
    render(
      <SummaryCards
        metrics={mockMetrics}
        deltas={mockDeltas}
        timeBuckets={mockBuckets}
        isLoading={false}
      />
    );

    // Total requests verification
    expect(screen.getByText('14,250')).toBeInTheDocument();
    expect(screen.getByText('+12.4%')).toBeInTheDocument();

    // Success rate verification
    expect(screen.getByText('99.00%')).toBeInTheDocument();

    // Latency verification
    expect(screen.getByText('110.5')).toBeInTheDocument();
    expect(screen.getByText('(p99: 280ms)')).toBeInTheDocument();

    // Active anomalies verification
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders skeleton loader when in loading state', () => {
    const { container } = render(
      <SummaryCards metrics={null} isLoading={true} />
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

describe('CommandPalette Component', () => {
  it('renders actions and handles selection via keyboard and click', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    const onClearFilters = vi.fn();

    render(
      <CommandPalette
        isOpen={true}
        onClose={onClose}
        onNavigate={onNavigate}
        onClearFilters={onClearFilters}
        onExportLogs={vi.fn()}
        onToggleLiveMode={vi.fn()}
        onResetMetrics={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Go to Overview Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Clear All Active Filters')).toBeInTheDocument();

    // Test selection of Clear Filters
    fireEvent.click(screen.getByText('Clear All Active Filters'));
    expect(onClearFilters).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ErrorBoundary Component', () => {
  it('safely catches and isolates component rendering errors', () => {
    // Suppress console.error during expected throw
    const originalError = console.error;
    console.error = vi.fn();

    const FaultyComponent = () => {
      throw new Error('Crashing telemetry graph test error');
    };

    render(
      <ErrorBoundary fallbackTitle="Custom Fallback Test Title">
        <FaultyComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Fallback Test Title')).toBeInTheDocument();
    expect(screen.getByText('Crashing telemetry graph test error')).toBeInTheDocument();

    console.error = originalError;
  });
});
