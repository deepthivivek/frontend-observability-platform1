'use client';

import React from 'react';
import { ApiRequestLog, TimeBucket, AggregatedMetrics, DetectedAnomaly } from '../../types/telemetry';
import { AnalyticsHeader } from './AnalyticsHeader';
import { LatencyPercentileChart } from './LatencyPercentileChart';
import { TrafficHeatmap } from './TrafficHeatmap';
import { LatencyCDFChart } from './LatencyCDFChart';
import { ErrorBreakdownChart } from './ErrorBreakdownChart';
import { EndpointLeaderboard } from './EndpointLeaderboard';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface AnalyticsViewProps {
  logs: ApiRequestLog[];
  metrics: AggregatedMetrics | null;
  anomalies: DetectedAnomaly[];
  timeBuckets: TimeBucket[];
  totalLogsCount: number;
  onFilterEndpoint: (endpoint: string) => void;
  onFilterLatencyBucket?: (min: number, max: number) => void;
  onInspectLog?: (log: ApiRequestLog) => void;
  onCreateAlert?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  logs,
  metrics,
  anomalies,
  timeBuckets,
  totalLogsCount,
  onFilterEndpoint,
  onFilterLatencyBucket,
  onInspectLog,
  onCreateAlert = () => {},
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Executive Summary & SLO TTE Predictor Header */}
      <ErrorBoundary fallbackTitle="AI Analytics Copilot & SLO Engine">
        <AnalyticsHeader
          metrics={metrics}
          anomalies={anomalies}
          totalLogsCount={totalLogsCount}
          onCreateAlert={onCreateAlert}
        />
      </ErrorBoundary>

      {/* 2. Interactive Latency Percentile Area Chart */}
      <ErrorBoundary fallbackTitle="Latency Distribution Percentiles">
        <LatencyPercentileChart
          timeBuckets={timeBuckets}
          anomalies={anomalies}
        />
      </ErrorBoundary>

      {/* 3. Traffic Density Heatmap & "BubbleUp" Outlier Scatter Plot */}
      <ErrorBoundary fallbackTitle="Traffic Heatmap & BubbleUp Engine">
        <TrafficHeatmap
          logs={logs}
          timeBuckets={timeBuckets}
          onFilterBucket={onFilterLatencyBucket}
          onInspectOutlier={onInspectLog}
        />
      </ErrorBoundary>

      {/* 4. Cumulative Distribution Function (CDF) & Downstream Dependency Matrix */}
      <ErrorBoundary fallbackTitle="Latency CDF & Dependency Matrix">
        <LatencyCDFChart logs={logs} />
      </ErrorBoundary>

      {/* 5. Error Breakdown Stacked Bars & Endpoint Performance Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ErrorBoundary fallbackTitle="Error Rate Breakdown Engine">
          <ErrorBreakdownChart
            timeBuckets={timeBuckets}
            onCreateAlert={onCreateAlert}
          />
        </ErrorBoundary>

        <ErrorBoundary fallbackTitle="Endpoint Performance Leaderboard">
          <EndpointLeaderboard
            logs={logs}
            onFilterEndpoint={onFilterEndpoint}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
};
