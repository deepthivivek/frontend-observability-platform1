import { ApiRequestLog, HttpMethod } from './telemetry';

export type ExportFormat = 'json' | 'csv' | 'ndjson' | 'bundle';

export type ExportScope = 'filtered' | 'selected' | 'all';

export type ExportField =
  | 'timestamp'
  | 'method'
  | 'endpoint'
  | 'statusCode'
  | 'latencyMs'
  | 'traceId'
  | 'clientIp'
  | 'userAgent'
  | 'requestHeaders'
  | 'responseHeaders'
  | 'requestBody'
  | 'responseBody'
  | 'errorDetails';

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  fields: ExportField[];
  redactPii: boolean;
  selectedLogIds?: string[];
}

export interface SavedQueryView {
  id: string;
  name: string;
  query: string;
  createdAt: number;
  tags?: string[];
}

export interface QuerySnippet {
  id: string;
  name: string;
  query: string;
  category: 'Errors' | 'Performance' | 'Security' | 'Capacity';
  description: string;
}

export interface PayloadDiffEntry {
  path: string;
  baselineValue: unknown;
  targetValue: unknown;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
}
