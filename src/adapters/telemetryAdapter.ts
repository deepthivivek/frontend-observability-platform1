import { ApiRequestLog, HttpMethod } from '@/src/types/telemetry';

export class ProductionTelemetryAdapter {
  static parse(data: unknown): ApiRequestLog[] {
    const logs: ApiRequestLog[] = [];
    
    // Handle different formats: array, object, NDJSON (handled as array of objects)
    const rawData = Array.isArray(data) ? data : [data];

    for (const item of rawData) {
      try {
        if (!item || typeof item !== 'object') continue;
        
        const log = item as any;
        
        const parsedLog: ApiRequestLog = {
          id: String(log.id || crypto.randomUUID()),
          timestamp: typeof log.timestamp === 'number' ? log.timestamp : Date.now(),
          method: (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as HttpMethod[]).includes(log.method) ? log.method : 'GET',
          endpoint: String(log.endpoint || '/'),
          statusCode: typeof log.statusCode === 'number' ? log.statusCode : 200,
          latencyMs: typeof log.latencyMs === 'number' ? log.latencyMs : 0,
          clientIp: String(log.clientIp || '0.0.0.0'),
          userAgent: String(log.userAgent || 'unknown'),
          traceId: String(log.traceId || ''),
          spanId: String(log.spanId || ''),
          parentId: log.parentId ? String(log.parentId) : undefined,
          requestHeaders: log.requestHeaders || {},
          responseHeaders: log.responseHeaders || {},
          requestBody: log.requestBody,
          responseBody: log.responseBody,
          webVitals: log.webVitals,
          errorDetails: log.errorDetails
        };
        
        logs.push(parsedLog);
      } catch (e) {
        console.error('Failed to parse log row', e);
        // Fault-tolerant: skip malformed
      }
    }
    
    return logs;
  }
}
