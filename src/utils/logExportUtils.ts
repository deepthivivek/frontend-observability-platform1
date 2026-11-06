import { ApiRequestLog } from '../types/telemetry';
import { ExportOptions, ExportField, PayloadDiffEntry } from '../types/logStream';
import { redactSensitiveData } from './redactor';

export const ALL_EXPORT_FIELDS: { key: ExportField; label: string }[] = [
  { key: 'timestamp', label: 'Timestamp (ISO)' },
  { key: 'method', label: 'HTTP Method' },
  { key: 'endpoint', label: 'URL Endpoint' },
  { key: 'statusCode', label: 'Status Code' },
  { key: 'latencyMs', label: 'Duration (ms)' },
  { key: 'traceId', label: 'Trace ID' },
  { key: 'clientIp', label: 'Client IP' },
  { key: 'userAgent', label: 'User Agent' },
  { key: 'requestHeaders', label: 'Request Headers' },
  { key: 'responseHeaders', label: 'Response Headers' },
  { key: 'requestBody', label: 'Request Body' },
  { key: 'responseBody', label: 'Response Body' },
  { key: 'errorDetails', label: 'Error Stack & Message' },
];

/**
 * Deeply sanitizes a log with robust PII masking (including IP masking).
 */
export function sanitizeLog(log: ApiRequestLog, redactPii: boolean): ApiRequestLog {
  if (!redactPii) {
    return JSON.parse(JSON.stringify(log));
  }

  // Utilize verified Day 1 redactor
  const redacted = redactSensitiveData(log);

  // Mask client IP
  if (redacted.clientIp) {
    const parts = redacted.clientIp.split('.');
    if (parts.length === 4) {
      redacted.clientIp = `${parts[0]}.${parts[1]}.xxx.xxx`;
    } else {
      redacted.clientIp = '[REDACTED_IP]';
    }
  }

  // Mask any password or token tokens in endpoint query strings
  if (redacted.endpoint && (redacted.endpoint.includes('token=') || redacted.endpoint.includes('key=') || redacted.endpoint.includes('secret='))) {
    redacted.endpoint = redacted.endpoint
      .replace(/([?&](?:token|key|secret|password)=)[^&]+/gi, '$1[REDACTED]');
  }

  return redacted;
}

/**
 * Pick selected fields from a log.
 */
export function pickLogFields(log: ApiRequestLog, fields: ExportField[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  fields.forEach((f) => {
    switch (f) {
      case 'timestamp':
        result.timestamp = new Date(log.timestamp).toISOString();
        break;
      case 'method':
        result.method = log.method;
        break;
      case 'endpoint':
        result.endpoint = log.endpoint;
        break;
      case 'statusCode':
        result.statusCode = log.statusCode;
        break;
      case 'latencyMs':
        result.latencyMs = log.latencyMs;
        break;
      case 'traceId':
        result.traceId = log.traceId;
        break;
      case 'clientIp':
        result.clientIp = log.clientIp;
        break;
      case 'userAgent':
        result.userAgent = log.userAgent;
        break;
      case 'requestHeaders':
        result.requestHeaders = log.requestHeaders;
        break;
      case 'responseHeaders':
        result.responseHeaders = log.responseHeaders;
        break;
      case 'requestBody':
        result.requestBody = log.requestBody;
        break;
      case 'responseBody':
        result.responseBody = log.responseBody;
        break;
      case 'errorDetails':
        result.errorDetails = log.errorDetails;
        break;
    }
  });

  return result;
}

/**
 * Convert selected logs to CSV formatted string.
 */
export function convertLogsToCsv(data: Record<string, unknown>[], fields: ExportField[]): string {
  if (data.length === 0) return '';

  const headers = fields.map((f) => JSON.stringify(f)).join(',');
  const rows = data.map((item) => {
    return fields
      .map((f) => {
        const val = item[f];
        if (val === undefined || val === null) return '""';
        if (typeof val === 'object') {
          return JSON.stringify(JSON.stringify(val));
        }
        return JSON.stringify(String(val));
      })
      .join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * Generates an export file Blob and filename according to selected options.
 */
export function generateLogExport(
  logs: ApiRequestLog[],
  options: ExportOptions
): { content: string; mimeType: string; filename: string } {
  const sanitizedLogs = logs.map((l) => sanitizeLog(l, options.redactPii));
  const pickedLogs = sanitizedLogs.map((l) => pickLogFields(l, options.fields));

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');

  if (options.format === 'csv') {
    const csvContent = convertLogsToCsv(pickedLogs, options.fields);
    return {
      content: csvContent,
      mimeType: 'text/csv;charset=utf-8;',
      filename: `observability_logs_${timestampStr}.csv`,
    };
  }

  if (options.format === 'ndjson') {
    const ndjsonContent = pickedLogs.map((item) => JSON.stringify(item)).join('\n');
    return {
      content: ndjsonContent,
      mimeType: 'application/x-ndjson;charset=utf-8;',
      filename: `observability_logs_${timestampStr}.ndjson`,
    };
  }

  if (options.format === 'bundle') {
    const diagnosticBundle = {
      bundleVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      piiRedacted: options.redactPii,
      selectedFields: options.fields,
      systemMetrics: {
        totalExportedLogs: logs.length,
        errorLogsCount: logs.filter((l) => l.statusCode >= 400).length,
        avgLatencyMs: Math.round(
          logs.reduce((acc, l) => acc + l.latencyMs, 0) / (logs.length || 1)
        ),
      },
      clientEnvironment: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'NodeJS',
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A',
      },
      logs: pickedLogs,
    };

    return {
      content: JSON.stringify(diagnosticBundle, null, 2),
      mimeType: 'application/json;charset=utf-8;',
      filename: `diagnostic_bundle_${timestampStr}.json`,
    };
  }

  // Default: JSON Array
  return {
    content: JSON.stringify(pickedLogs, null, 2),
    mimeType: 'application/json;charset=utf-8;',
    filename: `observability_logs_${timestampStr}.json`,
  };
}

/**
 * Structural payload diffing between baseline and target objects.
 */
export function diffPayloads(
  baseline: unknown,
  target: unknown,
  prefix: string = ''
): PayloadDiffEntry[] {
  const entries: PayloadDiffEntry[] = [];

  const isObj = (val: unknown): val is Record<string, unknown> =>
    typeof val === 'object' && val !== null && !Array.isArray(val);

  const baseObj = isObj(baseline) ? baseline : {};
  const targetObj = isObj(target) ? target : {};

  const allKeys = Array.from(new Set([...Object.keys(baseObj), ...Object.keys(targetObj)])).sort();

  for (const key of allKeys) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    const hasInBase = key in baseObj;
    const hasInTarget = key in targetObj;

    const valBase = baseObj[key];
    const valTarget = targetObj[key];

    if (!hasInBase && hasInTarget) {
      entries.push({
        path: currentPath,
        baselineValue: undefined,
        targetValue: valTarget,
        status: 'added',
      });
    } else if (hasInBase && !hasInTarget) {
      entries.push({
        path: currentPath,
        baselineValue: valBase,
        targetValue: undefined,
        status: 'removed',
      });
    } else if (isObj(valBase) && isObj(valTarget)) {
      entries.push(...diffPayloads(valBase, valTarget, currentPath));
    } else if (JSON.stringify(valBase) !== JSON.stringify(valTarget)) {
      entries.push({
        path: currentPath,
        baselineValue: valBase,
        targetValue: valTarget,
        status: 'modified',
      });
    } else {
      entries.push({
        path: currentPath,
        baselineValue: valBase,
        targetValue: valTarget,
        status: 'unchanged',
      });
    }
  }

  return entries;
}
