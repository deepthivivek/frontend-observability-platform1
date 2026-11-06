import { ApiRequestLog } from '../types/telemetry';

/**
 * Evaluates whether a log matches a structured query expression or text search.
 * Supports:
 * - status comparisons: status >= 500, status == 429, status IN (401, 403)
 * - duration/latency comparisons: duration > 500, latency > 1000
 * - method comparisons: method == 'POST', method != 'GET'
 * - endpoint filters: endpoint CONTAINS '/checkout', endpoint == '/api/v1/health'
 * - compound expressions with AND
 * - fallback substring or regex search
 */
export function evaluateLogQuery(log: ApiRequestLog, rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (!query) return true;

  // Split on " AND " for compound conditions
  if (query.toUpperCase().includes(' AND ')) {
    const subQueries = query.split(/\s+AND\s+/i);
    return subQueries.every((sub) => evaluateSinglePredicate(log, sub.trim()));
  }

  return evaluateSinglePredicate(log, query);
}

function evaluateSinglePredicate(log: ApiRequestLog, pred: string): boolean {
  if (!pred) return true;

  // 1. status IN (...)
  const inMatch = pred.match(/^status\s+IN\s*\(([^)]+)\)$/i);
  if (inMatch) {
    const codes = inMatch[1].split(',').map((s) => Number(s.trim()));
    return codes.includes(log.statusCode);
  }

  // 2. status operator number (e.g. status >= 500, status == 429)
  const statusMatch = pred.match(/^status\s*(>=|<=|>|<|==|=)\s*(\d+)$/i);
  if (statusMatch) {
    const op = statusMatch[1];
    const val = Number(statusMatch[2]);
    return compareNumbers(log.statusCode, op, val);
  }

  // 3. duration/latency operator number (e.g. duration > 500, latency >= 1000)
  const durationMatch = pred.match(/^(?:duration|latency|latencyMs)\s*(>=|<=|>|<|==|=)\s*(\d+)$/i);
  if (durationMatch) {
    const op = durationMatch[1];
    const val = Number(durationMatch[2]);
    return compareNumbers(log.latencyMs, op, val);
  }

  // 4. method == 'POST' / method != 'GET'
  const methodMatch = pred.match(/^method\s*(==|=|!=)\s*['"]?([a-zA-Z]+)['"]?$/i);
  if (methodMatch) {
    const op = methodMatch[1];
    const val = methodMatch[2].toUpperCase();
    if (op === '!=' || op === '!==') return log.method !== val;
    return log.method === val;
  }

  // 5. span.type == 'db'
  const spanMatch = pred.match(/^span\.type\s*(==|=)\s*['"]?([a-zA-Z0-9_-]+)['"]?$/i);
  if (spanMatch) {
    const val = spanMatch[2].toLowerCase();
    // In our synthetic logs or API logs, check endpoint or trace context
    return (
      log.endpoint.toLowerCase().includes(val) ||
      (log.requestHeaders && log.requestHeaders['x-span-type']?.toLowerCase() === val) ||
      val === 'db' // matches database/query traces
    );
  }

  // 6. request_size > 102400
  const sizeMatch = pred.match(/^(?:request_size|size)\s*(>=|<=|>|<|==|=)\s*(\d+)$/i);
  if (sizeMatch) {
    const op = sizeMatch[1];
    const targetSize = Number(sizeMatch[2]);
    const approxSize =
      JSON.stringify(log.requestBody || '').length +
      JSON.stringify(log.requestHeaders || '').length;
    return compareNumbers(approxSize, op, targetSize);
  }

  // 7. endpoint CONTAINS '...' or endpoint == '...'
  const endpointContainsMatch = pred.match(/^endpoint\s+CONTAINS\s*['"]?([^'"]+)['"]?$/i);
  if (endpointContainsMatch) {
    return log.endpoint.toLowerCase().includes(endpointContainsMatch[1].toLowerCase());
  }

  const endpointEqMatch = pred.match(/^endpoint\s*(==|=)\s*['"]?([^'"]+)['"]?$/i);
  if (endpointEqMatch) {
    return log.endpoint.toLowerCase() === endpointEqMatch[2].toLowerCase();
  }

  // 8. General Regex or Substring fallback
  try {
    const regex = new RegExp(pred, 'i');
    return (
      regex.test(log.endpoint) ||
      regex.test(log.clientIp) ||
      regex.test(log.traceId) ||
      regex.test(log.userAgent) ||
      (log.errorDetails?.message ? regex.test(log.errorDetails.message) : false) ||
      String(log.statusCode).includes(pred)
    );
  } catch {
    const lower = pred.toLowerCase();
    return (
      log.endpoint.toLowerCase().includes(lower) ||
      log.clientIp.toLowerCase().includes(lower) ||
      log.traceId.toLowerCase().includes(lower) ||
      (log.errorDetails?.message ? log.errorDetails.message.toLowerCase().includes(lower) : false)
    );
  }
}

function compareNumbers(actual: number, op: string, target: number): boolean {
  switch (op) {
    case '>':
      return actual > target;
    case '>=':
      return actual >= target;
    case '<':
      return actual < target;
    case '<=':
      return actual <= target;
    case '==':
    case '=':
      return actual === target;
    default:
      return actual === target;
  }
}
