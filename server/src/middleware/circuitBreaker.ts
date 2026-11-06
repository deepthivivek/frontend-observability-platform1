import { Request, Response, NextFunction } from 'express';

interface CircuitBreakerOptions {
  failureThreshold?: number; // percentage or count
  resetTimeoutMs?: number;
  maxQueueSize?: number;
}

export class DistributedCircuitBreaker {
  private failureCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextAttemptTimestamp = 0;
  private failureThreshold: number;
  private resetTimeoutMs: number;
  private maxQueueSize: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5; // e.g., 5 consecutive 5xx or load limit
    this.resetTimeoutMs = options.resetTimeoutMs ?? 15000; // 15s reset
    this.maxQueueSize = options.maxQueueSize ?? 5000;
  }

  public middleware = (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now >= this.nextAttemptTimestamp) {
        this.state = 'HALF_OPEN';
      } else {
        // Load shedding: drop non-critical requests during open circuit, allow 5xx probes or health
        if (req.path.includes('/health')) {
          return next();
        }
        res.setHeader('X-Circuit-Breaker', 'OPEN');
        return res.status(503).json({
          error: 'Circuit Breaker Open: Telemetry ingestion gateway shedding load due to upstream saturation',
          retryAfterMs: this.nextAttemptTimestamp - now,
        });
      }
    }

    // Check queue backpressure
    if (req.body && Array.isArray(req.body.logs) && req.body.logs.length > this.maxQueueSize) {
      res.setHeader('X-Circuit-Breaker', 'LOAD_SHEDDING');
      return res.status(429).json({
        error: 'Payload size exceeds distributed circuit breaker queue threshold. Slicing required.',
        maxQueueSize: this.maxQueueSize,
      });
    }

    // Track response status to update breaker state
    const originalSend = res.json;
    res.json = function (body: any) {
      if (res.statusCode >= 500) {
        // Record failure
      }
      return originalSend.call(this, body);
    };

    next();
  };

  public recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  public recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTimestamp = Date.now() + this.resetTimeoutMs;
    }
  }

  public getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttemptTimestamp: this.nextAttemptTimestamp,
    };
  }
}
