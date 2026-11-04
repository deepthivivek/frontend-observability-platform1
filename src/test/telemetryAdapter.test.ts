import { describe, it, expect } from 'vitest';
import { ProductionTelemetryAdapter } from '../adapters/telemetryAdapter';
import { redactSensitiveData } from '../utils/redactor';

describe('ProductionTelemetryAdapter', () => {
  it('should parse clean logs correctly', () => {
    const rawData = [{ id: '1', timestamp: 123, method: 'GET', endpoint: '/test', statusCode: 200, latencyMs: 50 }];
    const logs = ProductionTelemetryAdapter.parse(rawData);
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('1');
  });

  it('should handle malformed logs', () => {
    const rawData = [null, 'invalid', { id: '2' }];
    const logs = ProductionTelemetryAdapter.parse(rawData);
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('2');
  });
});

describe('redactSensitiveData', () => {
  it('should redact sensitive information', () => {
    const log: any = {
      requestHeaders: { authorization: 'secret-token' },
      requestBody: { password: 'my-password', email: 'test@example.com' }
    };
    const redacted = redactSensitiveData(log);
    expect(redacted.requestHeaders.authorization).toBe('[REDACTED]');
    expect(redacted.requestBody.password).toBe('[REDACTED]');
    expect(redacted.requestBody.email).toBe('[REDACTED]');
  });
});
