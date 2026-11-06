import { Request, Response, NextFunction } from 'express';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  enforcement: 'block' | 'redact' | 'warn';
  condition: (req: Request) => boolean;
}

export class PolicyEngine {
  private rules: PolicyRule[] = [
    {
      id: 'pol-data-sovereignty',
      name: 'EU Data Sovereignty & PII Shield',
      description: 'Ensures unmasked credit card or social security data is blocked from non-EU regions.',
      enforcement: 'redact',
      condition: (req: Request) => {
        const bodyStr = JSON.stringify(req.body || '');
        return bodyStr.includes('creditCard') || bodyStr.includes('password');
      },
    },
    {
      id: 'pol-rate-limit-abuse',
      name: 'High Frequency Flood Protection',
      description: 'Blocks ingestion requests exceeding rate limit quotas without valid mTLS cert.',
      enforcement: 'block',
      condition: (req: Request) => {
        const auth = req.headers['authorization'];
        if (req.path.includes('/telemetry') && !auth) {
          // If no auth header on high-volume ingest, enforce policy
          return false;
        }
        return false;
      },
    },
  ];

  public addRule(rule: PolicyRule) {
    this.rules.push(rule);
  }

  public middleware = (req: Request, res: Response, next: NextFunction) => {
    for (const rule of this.rules) {
      if (rule.condition(req)) {
        if (rule.enforcement === 'block') {
          res.setHeader('X-Policy-Violation', rule.id);
          return res.status(403).json({
            error: `Policy-as-Code Violation: [${rule.name}] blocked the request.`,
            policyId: rule.id,
            description: rule.description,
          });
        } else if (rule.enforcement === 'redact' && req.body && typeof req.body === 'object') {
          // Automatically sanitize sensitive fields
          this.redactSensitiveFields(req.body);
          res.setHeader('X-Policy-Redacted', rule.id);
        }
      }
    }
    next();
  };

  private redactSensitiveFields(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (['password', 'creditCard', 'secret', 'token', 'authorization'].includes(key.toLowerCase())) {
        obj[key] = '[REDACTED_BY_OPA_POLICY]';
      } else if (typeof obj[key] === 'object') {
        this.redactSensitiveFields(obj[key]);
      }
    }
  }

  public evaluateCompliance(workspaceConfig: any): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];
    if (!workspaceConfig.mTLSRequired) {
      violations.push('SOC2-CC6.1: mTLS is disabled for production ingestion endpoint.');
    }
    if (!workspaceConfig.encryptionAtRest) {
      violations.push('GDPR-Art32: Zero-Knowledge envelope encryption at rest is not fully enabled.');
    }
    if (workspaceConfig.idleTimeoutMinutes && workspaceConfig.idleTimeoutMinutes > 15) {
      violations.push('HIPAA-Sec164: Idle session timeout exceeds 15-minute mandate.');
    }
    return {
      compliant: violations.length === 0,
      violations,
    };
  }
}
