import {
  ApiRequestLog,
  FilterState,
  AggregatedMetrics,
  AnomalyRule,
  DetectedAnomaly,
  TimeBucket,
  MetricDeltas
} from './telemetry';

export type WorkerAction = 
  | { type: 'INGEST_CHUNK'; payload: { chunk: ApiRequestLog[]; isFinal: boolean; totalExpected?: number } }
  | { type: 'APPLY_FILTERS'; payload: { filters: Partial<FilterState>; requestId: string } }
  | { type: 'CALCULATE_METRICS'; payload: { requestId: string; previousWindowMinutes?: number } }
  | { type: 'COMPUTE_TIME_BUCKETS'; payload: { requestId: string; bucketSizeMinutes?: number } }
  | { type: 'EVALUATE_ANOMALIES'; payload: { rules: AnomalyRule[]; requestId: string } }
  | { type: 'MEMORY_GUARD' };

export type WorkerResponse = 
  | { type: 'INGESTION_PROGRESS'; payload: { processedCount: number; isComplete: boolean; throughputPerSec?: number } }
  | { type: 'FILTERS_APPLIED'; payload: { filteredIndices: Uint32Array; matchedCount: number; totalCount: number; requestId: string } }
  | { type: 'METRICS_CALCULATED'; payload: { metrics: AggregatedMetrics; deltas: MetricDeltas; requestId: string } }
  | { type: 'TIME_BUCKETS_COMPUTED'; payload: { buckets: TimeBucket[]; requestId: string } }
  | { type: 'ANOMALIES_EVALUATED'; payload: { anomalies: DetectedAnomaly[]; requestId: string } }
  | { type: 'MEMORY_STATS'; payload: { approximateLogCount: number; heapUsedMb?: number } }
  | { type: 'ERROR'; payload: { message: string; requestId?: string } };
