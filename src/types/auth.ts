export type AuthRole = 'admin' | 'editor' | 'viewer';

export interface AuthUserSummary {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string;
  totpEnabled?: boolean;
  recoveryCodesRemaining?: number;
}

export interface TenantWorkspaceSummary {
  tenantId: string;
  name: string;
  slug: string;
  status: 'active' | 'deactivated';
  ingestionPaused: boolean;
  ingestionRateLimitRps: number;
  retentionTtlDays: number;
  latencyWarnMs: number;
  latencyCritMs: number;
  errorRateThresholdPct: number;
  hasWebhookUrl?: boolean;
  maskedWebhookUrl?: string | null;
  createdAt: string;
  role?: AuthRole;
}

export interface UserSessionSummary {
  idPrefix: string;
  userId: string;
  tenantId: string;
  createdAt: string;
  expiresAt: number;
  idleExpiresAt?: number;
  stepUpVerifiedUntil?: number;
  ipAddress?: string;
  userAgent?: string;
  isCurrent: boolean;
}

export interface AuthSessionPayload {
  authenticated: boolean;
  hasUsers: boolean;
  mfaRequired?: boolean;
  user: AuthUserSummary | null;
  tenant: TenantWorkspaceSummary | null;
  tenants: TenantWorkspaceSummary[];
  role: AuthRole | null;
  stepUpActive?: boolean;
  stepUpVerifiedUntil?: number | null;
  idleExpiresAt?: number | null;
  expiresAt?: number | null;
  sessions: UserSessionSummary[];
  requestId?: string;
}
