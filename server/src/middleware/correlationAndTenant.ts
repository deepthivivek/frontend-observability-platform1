/**
 * Distributed Correlation ID, Structured JSON Access Logger & Multi-Tenant Auth Middleware
 * Ensures every HTTP request and OTLP ingestion batch carries an X-Request-ID correlation token,
 * deterministic JSON telemetry logs, and cryptographic tenant API key verification.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      tenantId?: string;
      authVerified?: boolean;
    }
  }
}

const EXEMPT_PROBE_PATHS = ['/healthz', '/readyz', '/api/v1/health'];

function sanitizeHeaderValue(value: unknown, fallback: string, maxLen = 128): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._:-]/g, '');
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLen);
}

function parseConfiguredTenantKeys(): Map<string, string> {
  const map = new Map<string, string>();
  const raw = process.env.TENANT_API_KEYS || '';
  for (const pair of raw.split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(':');
    if (sep > 0) {
      const tenant = trimmed.slice(0, sep).trim();
      const key = trimmed.slice(sep + 1).trim();
      if (tenant && key) {
        map.set(tenant, key);
      }
    }
  }
  return map;
}

export function deriveExpectedTenantToken(tenantId: string): string {
  const master =
    process.env.JWT_SECRET || 'neon_chasm_jwt_enterprise_master_secret_key_32chars';
  return crypto
    .createHmac('sha256', master)
    .update(`tenant:${tenantId}`)
    .digest('hex');
}

function constantTimeMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = sanitizeHeaderValue(incomingId, crypto.randomUUID(), 128);
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

export function structuredRequestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const durationMs = Number((Number(elapsedNs) / 1_000_000).toFixed(2));
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    const logRecord = {
      timestamp: new Date().toISOString(),
      level,
      service: process.env.OTEL_SERVICE_NAME || 'neon-chasm-gateway',
      requestId: req.requestId || 'unknown',
      tenantId: req.tenantId || 'default-tenant',
      authVerified: Boolean(req.authVerified),
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode,
      durationMs,
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    if (level === 'error') {
      console.error(JSON.stringify(logRecord));
    } else {
      console.log(JSON.stringify(logRecord));
    }
  });

  next();
}

export function tenantAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tenantId = sanitizeHeaderValue(req.headers['x-tenant-id'], 'default-tenant', 64);
  req.tenantId = tenantId;
  res.setHeader('X-Tenant-ID', tenantId);

  if (EXEMPT_PROBE_PATHS.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
    req.authVerified = true;
    return next();
  }

  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
  const apiKeyHeader = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'].trim() : '';
  const strictRequired = process.env.TENANT_AUTH_REQUIRED === 'true';

  if (authHeader && !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authorization header must use Bearer token scheme.',
      code: 'INVALID_AUTH_SCHEME',
      requestId: req.requestId,
      tenantId,
      timestamp: Date.now(),
    });
    return;
  }

  const presentedToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : apiKeyHeader;

  if (!presentedToken) {
    if (strictRequired) {
      res.status(401).json({
        error: 'Missing cryptographic tenant Bearer token or X-API-Key credential.',
        code: 'TENANT_AUTH_REQUIRED',
        requestId: req.requestId,
        tenantId,
        timestamp: Date.now(),
      });
      return;
    }
    req.authVerified = false;
    return next();
  }

  const configuredKeys = parseConfiguredTenantKeys();
  const expectedKey = configuredKeys.get(tenantId) || deriveExpectedTenantToken(tenantId);

  if (!constantTimeMatch(presentedToken, expectedKey)) {
    if (strictRequired || authHeader.length > 0 || apiKeyHeader.length > 0) {
      res.status(403).json({
        error: 'Invalid cryptographic tenant API credential for requested X-Tenant-ID.',
        code: 'INVALID_TENANT_CREDENTIAL',
        requestId: req.requestId,
        tenantId,
        timestamp: Date.now(),
      });
      return;
    }
  }

  req.authVerified = true;
  next();
}
