/**
 * Production Hardening Middleware
 * Enforces strict Zod v4 request validation (clean HTTP 400 diagnostics) and
 * token-bucket rate limiting (HTTP 429 with Retry-After + X-RateLimit-* headers).
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

// ---------------------------------------------------------------------------
// 1. Zod Request Validation Schemas (Zod v4 compatible)
// ---------------------------------------------------------------------------

export const TelemetryLogRecordSchema = z.object({
  id: z.string().min(1).optional(),
  timestamp: z.number().optional(),
  method: z.string().min(1).max(16).optional(),
  endpoint: z.string().min(1).max(512).optional(),
  statusCode: z.number().int().min(100).max(599).optional(),
  latencyMs: z.number().nonnegative().optional(),
  traceId: z.string().optional(),
  message: z.string().optional(),
  level: z.string().optional(),
  service: z.string().optional(),
}).passthrough();

export const TelemetryIngestSchema = z
  .object({
    logs: z.array(TelemetryLogRecordSchema).max(10000).optional(),
    metrics: z.array(z.record(z.string(), z.unknown())).max(10000).optional(),
    spans: z.array(z.record(z.string(), z.unknown())).max(10000).optional(),
    resourceLogs: z.array(z.record(z.string(), z.unknown())).max(1000).optional(),
    resourceMetrics: z.array(z.record(z.string(), z.unknown())).max(1000).optional(),
    resourceSpans: z.array(z.record(z.string(), z.unknown())).max(1000).optional(),
    source: z.string().trim().min(1).max(128).optional(),
  })
  .refine(
    (val) =>
      (Array.isArray(val.logs) && val.logs.length > 0) ||
      (Array.isArray(val.metrics) && val.metrics.length > 0) ||
      (Array.isArray(val.spans) && val.spans.length > 0) ||
      (Array.isArray(val.resourceLogs) && val.resourceLogs.length > 0) ||
      (Array.isArray(val.resourceMetrics) && val.resourceMetrics.length > 0) ||
      (Array.isArray(val.resourceSpans) && val.resourceSpans.length > 0),
    {
      message:
        'Telemetry payload must include at least one non-empty array among logs, metrics, spans, resourceLogs, resourceMetrics, or resourceSpans.',
    }
  );

export const PromqlQuerySchema = z.object({
  query: z.string().trim().min(1, 'PromQL query string is required.').max(2048),
  range: z.string().trim().min(1).max(32).optional(),
  step: z.union([z.string().trim().min(1), z.number().positive()]).optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
});

export const AiTranslateSchema = z.object({
  prompt: z.string().trim().min(2, 'Prompt must contain at least 2 characters.').max(1000),
});

export const AlertEvaluateSchema = z.object({
  widgets: z.array(z.record(z.string(), z.unknown())).min(1, 'At least one widget definition is required.').max(250),
});

export const SiemDispatchSchema = z.object({
  webhookUrl: z.string().url('webhookUrl must be a valid HTTP/HTTPS URL.'),
  eventType: z.string().trim().min(1).max(128).optional(),
  payload: z.unknown().optional(),
});

export const ComplianceAuditSchema = z.object({
  workspaceId: z.string().trim().min(1).max(128).optional(),
  mTLSRequired: z.boolean().optional(),
  encryptionAtRest: z.boolean().optional(),
  idleTimeoutMinutes: z.number().int().min(1).max(1440).optional(),
});

export const AkashaConvergeSchema = z.object({
  triggerVector: z.string().trim().min(3, 'triggerVector must be at least 3 characters.').max(128).optional(),
  timelineSpanYears: z.coerce.number().int().min(1).max(1_000_000).optional(),
});

export const SwarmProposalSchema = z.object({
  targetService: z.string().trim().min(1).max(128).optional(),
  anomalySignature: z.string().trim().min(1).max(256).optional(),
  recommendedAction: z.string().trim().min(1).max(256).optional(),
  dissentingAgent: z.string().trim().min(1).max(64).optional(),
});

export const RbacPolicyUpdateSchema = z.object({
  roleId: z.string().trim().min(1).max(64),
  roleName: z.string().trim().min(1).max(128),
  permissions: z.record(z.string(), z.boolean()),
  actor: z.string().trim().min(1).max(128).optional(),
});

// ---------------------------------------------------------------------------
// 2. Express Zod Validation Middleware Factory
// ---------------------------------------------------------------------------

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Request payload failed strict schema validation.',
        code: 'INVALID_PAYLOAD',
        requestId: req.requestId,
        tenantId: req.tenantId || 'default-tenant',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length > 0 ? issue.path.join('.') : 'body',
          message: issue.message,
          code: issue.code,
        })),
        timestamp: Date.now(),
      });
    }
    req.body = parsed.data;
    next();
  };
}

// ---------------------------------------------------------------------------
// 3. Multi-Tenant Dynamic Token-Bucket Rate Limiter (HTTP 429 + Retry-After)
// ---------------------------------------------------------------------------

interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

export interface RateLimiterOptions {
  capacity?: number;
  refillPerSec?: number;
  exemptPaths?: string[];
}

export class TokenBucketRateLimiter {
  private readonly capacity: number;
  private readonly refillPerSec: number;
  private readonly exemptPaths: string[];
  private readonly buckets = new Map<string, BucketState>();

  constructor(options: RateLimiterOptions = {}) {
    this.capacity = options.capacity ?? Number(process.env.RATE_LIMIT_BURST || 240);
    this.refillPerSec = options.refillPerSec ?? Number(process.env.RATE_LIMIT_RPS || 60);
    this.exemptPaths = options.exemptPaths ?? ['/healthz', '/readyz', '/api/v1/health'];
  }

  private getClientKey(req: Request): string {
    const tenantId = req.tenantId || (typeof req.headers['x-tenant-id'] === 'string' ? req.headers['x-tenant-id'].trim() : 'default-tenant');
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string' && forwarded.trim().length > 0
        ? forwarded.split(',')[0].trim()
        : req.ip || req.socket?.remoteAddress || 'global-client';
    return `tenant:${tenantId}:${ip}`;
  }

  public consume(clientKey: string, cost = 1): {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
    resetUnixSeconds: number;
  } {
    const now = Date.now();
    const existing = this.buckets.get(clientKey) || {
      tokens: this.capacity,
      lastRefillMs: now,
    };

    const elapsedSec = Math.max(0, (now - existing.lastRefillMs) / 1000);
    const refilled = Math.min(this.capacity, existing.tokens + elapsedSec * this.refillPerSec);

    if (refilled < cost) {
      this.buckets.set(clientKey, { tokens: refilled, lastRefillMs: now });
      const deficit = cost - refilled;
      const retryAfterSeconds = Math.max(1, Math.ceil(deficit / this.refillPerSec));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        resetUnixSeconds: Math.ceil(now / 1000) + retryAfterSeconds,
      };
    }

    const remaining = refilled - cost;
    this.buckets.set(clientKey, { tokens: remaining, lastRefillMs: now });

    // Prevent unbounded bucket map growth under spoofed IPs
    if (this.buckets.size > 5000) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey) this.buckets.delete(oldestKey);
    }

    const secondsToFull = Math.ceil((this.capacity - remaining) / this.refillPerSec);
    return {
      allowed: true,
      remaining: Math.floor(remaining),
      retryAfterSeconds: 0,
      resetUnixSeconds: Math.ceil(now / 1000) + secondsToFull,
    };
  }

  public reset(): void {
    this.buckets.clear();
  }

  public middleware = (req: Request, res: Response, next: NextFunction) => {
    if (this.exemptPaths.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
      return next();
    }

    const key = this.getClientKey(req);
    const result = this.consume(key, 1);

    res.setHeader('X-RateLimit-Limit', String(this.capacity));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(result.resetUnixSeconds));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      return res.status(429).json({
        error: 'Ingestion rate limit exceeded for tenant bucket. Respect Retry-After before retrying.',
        code: 'RATE_LIMIT_EXCEEDED',
        requestId: req.requestId,
        tenantId: req.tenantId || 'default-tenant',
        retryAfterSeconds: result.retryAfterSeconds,
        timestamp: Date.now(),
      });
    }

    next();
  };
}

export const defaultRateLimiter = new TokenBucketRateLimiter();
