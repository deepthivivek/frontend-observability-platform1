import { ApiRequestLog } from '@/src/types/telemetry';

export function redactSensitiveData(log: ApiRequestLog): ApiRequestLog {
  const redactedLog = JSON.parse(JSON.stringify(log));

  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'bearer'];
  const sensitiveBodyKeys = ['password', 'token', 'secret', 'creditCard', 'ssn', 'email'];

  const redactObject = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      if (sensitiveBodyKeys.includes(key.toLowerCase())) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        redactObject(obj[key]);
      }
    }
  };

  for (const header in redactedLog.requestHeaders) {
    if (sensitiveHeaders.includes(header.toLowerCase())) {
      redactedLog.requestHeaders[header] = '[REDACTED]';
    }
  }

  redactObject(redactedLog.requestBody);
  redactObject(redactedLog.responseBody);

  return redactedLog;
}
