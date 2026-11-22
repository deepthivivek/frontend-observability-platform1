/**
 * Native Next.js Server-Side Multi-Tenant Auth, Session, RBAC, TOTP MFA, Step-Up Auth,
 * AES-256-GCM Secret Storage, API Key, Telemetry Isolation, Rate-Limit, Deduplication &
 * Hash-Chained Audit Store.
 *
 * Persists atomically to DATA_DIR / NEON_CHASM_STATE_DIR (or os.tmpdir()/neon-chasm-state)
 * with automatic in-memory fallback if the runtime filesystem is read-only.
 */

import 'server-only';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildTotpOtpAuthUri,
  decryptSensitiveValue,
  encryptSensitiveValue,
  generateRecoveryCodes,
  generateTotpSecret,
  maskSecretUrl,
  verifyAndConsumeRecoveryCode,
  verifyTotpCodeWithWindow,
} from './securityUtils';

export type UserRole = 'admin' | 'editor' | 'viewer';
export type ApiKeyScope = 'ingest:write' | 'telemetry:read';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string;
  totpEnabled?: boolean;
  totpSecretEncrypted?: string;
  pendingTotpSecretEncrypted?: string;
  lastTotpStepUsed?: number;
  recoveryCodeHashes?: string[];
}

export interface TenantWorkspace {
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
  webhookUrlEncrypted?: string;
  createdAt: string;
}

export interface TenantMembership {
  userId: string;
  tenantId: string;
  role: UserRole;
  joinedAt: string;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  createdAt: string;
  expiresAt: number;
  idleExpiresAt: number;
  stepUpVerifiedUntil?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApiKeyRecord {
  keyId: string;
  tenantId: string;
  name: string;
  prefix: string;
  hash: string;
  scopes: ApiKeyScope[];
  allowedCidrs?: string[];
  expiresAt?: string;
  graceExpiresAt?: number;
  createdAt: string;
  revokedAt?: string;
}

export interface InviteRecord {
  inviteId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  tokenHash: string;
  expiresAt: number;
  createdBy: string;
  createdAt: string;
  usedAt?: string;
}

export interface TenantAuditEntry {
  id: string;
  tenantId: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  requestId: string;
  prevHash: string;
  entryHash: string;
}

export interface TelemetryRecord {
  id: string;
  timestamp: number;
  tenantId: string;
  requestId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  traceId: string;
  spanId: string;
  service: string;
  level: string;
  message: string;
  attributes?: Record<string, unknown>;
}

export interface PersistedAuthStoreState {
  version: number;
  users: Record<string, UserAccount>;
  tenants: Record<string, TenantWorkspace>;
  memberships: TenantMembership[];
  sessions: Record<string, UserSession>;
  apiKeys: Record<string, ApiKeyRecord[]>;
  invites: InviteRecord[];
  auditLogs: Record<string, TenantAuditEntry[]>;
  telemetryByTenant: Record<string, TelemetryRecord[]>;
  dashboardPresetsByTenant: Record<string, unknown[]>;
}

const SESSION_COOKIE_NAME = 'neon_chasm_session';
const SESSION_ABSOLUTE_TTL_MS = Math.max(
  60_000,
  Number(process.env.SESSION_ABSOLUTE_TTL_MS || 1000 * 60 * 60 * 24) || 1000 * 60 * 60 * 24
); // 24h absolute lifetime default
const SESSION_IDLE_TTL_MS = Math.max(
  30_000,
  Number(process.env.SESSION_IDLE_TTL_MS || 1000 * 60 * 30) || 1000 * 60 * 30
); // 30m sliding idle timeout default
const STEP_UP_TTL_MS = 1000 * 60 * 5; // 5m step-up re-authentication window
const MAX_RECORDS_PER_TENANT = 2000;
const MAX_AUDIT_PER_TENANT = 500;
const MAX_SSE_PER_TENANT = 50;
const MAX_SSE_GLOBAL = 500;
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const globalForAuth = globalThis as typeof globalThis & {
  __neonChasmSessionSecret?: string;
  __neonChasmAuthStore?: AuthStoreManager;
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 2) return false;
    const [salt, keyHex] = parts;
    if (!salt || !keyHex) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(derived, storedBuf);
  } catch {
    return false;
  }
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function timingSafeHexMatch(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function createEmptyState(): PersistedAuthStoreState {
  return {
    version: 3,
    users: {},
    tenants: {},
    memberships: [],
    sessions: {},
    apiKeys: {},
    invites: [],
    auditLogs: {},
    telemetryByTenant: {},
    dashboardPresetsByTenant: {},
  };
}

function ipToInt(ip: string): number | null {
  const clean = ip.replace(/^::ffff:/, '').trim();
  const parts = clean.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  return num >>> 0;
}

function isIpInAllowlist(clientIp: string | undefined, allowedCidrs?: string[]): boolean {
  if (!allowedCidrs || allowedCidrs.length === 0) return true;
  if (!clientIp) return false;
  const cleanIp = clientIp.split(',')[0].trim().replace(/^::ffff:/, '');
  for (const cidr of allowedCidrs) {
    const trimmed = cidr.trim();
    if (!trimmed) continue;
    if (trimmed === cleanIp) return true;
    const [net, bitsStr] = trimmed.split('/');
    const bits = Number(bitsStr);
    const ipInt = ipToInt(cleanIp);
    const netInt = ipToInt(net);
    if (ipInt !== null && netInt !== null && Number.isInteger(bits) && bits >= 0 && bits <= 32) {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      if ((ipInt & mask) === (netInt & mask)) return true;
    }
  }
  return false;
}

interface LoginAttemptTracker {
  failures: number;
  blockedUntil: number;
  lastAttemptAt: number;
}

interface TenantRateBucket {
  tokens: number;
  lastRefillMs: number;
}

export interface PlatformDiagnosticsSnapshot {
  activeSseSubscribers: number;
  totalTenants: number;
  totalUsers: number;
  totalBufferedRecords: number;
  estimatedBufferBytes: number;
  authChecksTotal: number;
  authChecksDenied: number;
  totalIngestBatches: number;
  totalIngestedRecords: number;
  redactedSecretsTotal: number;
  ingestionEventsPerSec: number;
  uptimeSeconds: number;
}

class AuthStoreManager {
  private state: PersistedAuthStoreState;
  private readonly storeDir: string;
  private readonly storeFile: string;
  private readonly devSecretFile: string;
  private readOnlyFallback = false;
  private lastLoadedMtimeMs = 0;
  private loginAttempts = new Map<string, LoginAttemptTracker>();
  private rateBuckets = new Map<string, TenantRateBucket>();
  private recentDedupKeys = new Map<string, number>();
  private readonly startedAtMs = Date.now();
  private sseSubscribers = new Map<string, Set<(records: TelemetryRecord[]) => void>>();
  private authChecksTotal = 0;
  private authChecksDenied = 0;
  private totalIngestBatches = 0;
  private totalIngestedRecords = 0;
  private redactedSecretsTotal = 0;
  private ingestWindowTimestamps: number[] = [];

  constructor() {
    this.storeDir =
      process.env.DATA_DIR ||
      process.env.NEON_CHASM_STATE_DIR ||
      path.join(os.tmpdir(), 'neon-chasm-state');
    this.storeFile = path.join(this.storeDir, 'multi-tenant-auth-v2.json');
    this.devSecretFile = path.join(this.storeDir, 'signing-secret.key');
    this.state = this.loadFromDisk();
  }

  public getSigningSecret(): string {
    const envSecret = process.env.SESSION_SECRET;
    if (process.env.NODE_ENV === 'production') {
      if (!envSecret || envSecret.length < 32) {
        throw new Error(
          'SESSION_SECRET environment variable (minimum 32 characters) is required when NODE_ENV=production.'
        );
      }
      return envSecret;
    }

    if (envSecret && envSecret.length >= 32) {
      return envSecret;
    }

    if (globalForAuth.__neonChasmSessionSecret && globalForAuth.__neonChasmSessionSecret.length >= 32) {
      return globalForAuth.__neonChasmSessionSecret;
    }

    try {
      if (fs.existsSync(this.devSecretFile)) {
        const diskSecret = fs.readFileSync(this.devSecretFile, 'utf8').trim();
        if (diskSecret.length >= 32) {
          globalForAuth.__neonChasmSessionSecret = diskSecret;
          return diskSecret;
        }
      }
    } catch {
      // Ignore read failure in dev/test and generate local secret
    }

    const generated = crypto.randomBytes(32).toString('hex');
    globalForAuth.__neonChasmSessionSecret = generated;

    if (!this.readOnlyFallback) {
      try {
        if (!fs.existsSync(this.storeDir)) {
          fs.mkdirSync(this.storeDir, { recursive: true, mode: 0o750 });
        }
        const tmpKey = `${this.devSecretFile}.tmp.${process.pid}.${crypto.randomUUID()}`;
        const fd = fs.openSync(tmpKey, 'w', 0o600);
        try {
          fs.writeSync(fd, `${generated}\n`, 0, 'utf8');
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        fs.renameSync(tmpKey, this.devSecretFile);
      } catch {
        // Non-fatal in read-only non-production test environments
      }
    }
    return generated;
  }

  private syncIfDiskUpdated(): void {
    if (this.readOnlyFallback) return;
    try {
      if (!fs.existsSync(this.storeFile)) return;
      const stat = fs.statSync(this.storeFile);
      if (stat.mtimeMs > this.lastLoadedMtimeMs) {
        this.state = this.loadFromDisk();
      }
    } catch {
      // Ignore stat errors and keep current in-memory state
    }
  }

  private loadFromDisk(): PersistedAuthStoreState {
    try {
      if (fs.existsSync(this.storeFile)) {
        const stat = fs.statSync(this.storeFile);
        const raw = fs.readFileSync(this.storeFile, 'utf8');
        const parsed = JSON.parse(raw) as Partial<PersistedAuthStoreState>;
        this.lastLoadedMtimeMs = stat.mtimeMs;
        if (parsed && typeof parsed === 'object') {
          return {
            version: 3,
            users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
            tenants: parsed.tenants && typeof parsed.tenants === 'object' ? parsed.tenants : {},
            memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
            sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
            apiKeys: parsed.apiKeys && typeof parsed.apiKeys === 'object' ? parsed.apiKeys : {},
            invites: Array.isArray(parsed.invites) ? parsed.invites : [],
            auditLogs: parsed.auditLogs && typeof parsed.auditLogs === 'object' ? parsed.auditLogs : {},
            telemetryByTenant:
              parsed.telemetryByTenant && typeof parsed.telemetryByTenant === 'object'
                ? parsed.telemetryByTenant
                : {},
            dashboardPresetsByTenant:
              parsed.dashboardPresetsByTenant && typeof parsed.dashboardPresetsByTenant === 'object'
                ? parsed.dashboardPresetsByTenant
                : {},
          };
        }
      }
    } catch {
      // Fallback safely to clean zero-mock state
    }
    return createEmptyState();
  }

  private persist(): void {
    if (this.readOnlyFallback) return;
    const now = Date.now();
    for (const [sid, sess] of Object.entries(this.state.sessions)) {
      if (now > sess.expiresAt || (sess.idleExpiresAt && now > sess.idleExpiresAt)) {
        delete this.state.sessions[sid];
      }
    }

    let tmpPath = '';
    try {
      if (!fs.existsSync(this.storeDir)) {
        fs.mkdirSync(this.storeDir, { recursive: true, mode: 0o750 });
      }
      tmpPath = `${this.storeFile}.tmp.${process.pid}.${crypto.randomUUID()}`;
      const payload = JSON.stringify(this.state, null, 2);
      const fd = fs.openSync(tmpPath, 'w', 0o600);
      try {
        fs.writeSync(fd, payload, 0, 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(tmpPath, this.storeFile);
      this.lastLoadedMtimeMs = fs.statSync(this.storeFile).mtimeMs;
    } catch {
      if (tmpPath && fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          // Ignore temp file cleanup error
        }
      }
      this.readOnlyFallback = true;
    }
  }

  public hasAnyUsers(): boolean {
    this.syncIfDiskUpdated();
    return Object.keys(this.state.users).length > 0;
  }

  public getUserById(userId: string): UserAccount | null {
    this.syncIfDiskUpdated();
    return this.state.users[userId] || null;
  }

  public getTenantById(tenantId: string): TenantWorkspace | null {
    this.syncIfDiskUpdated();
    return this.state.tenants[tenantId] || null;
  }

  public getUserWorkspaces(userId: string): Array<TenantWorkspace & { role: UserRole }> {
    this.syncIfDiskUpdated();
    const result: Array<TenantWorkspace & { role: UserRole }> = [];
    for (const m of this.state.memberships) {
      if (m.userId !== userId) continue;
      const t = this.state.tenants[m.tenantId];
      if (t && t.status === 'active') {
        result.push({ ...t, role: m.role });
      }
    }
    return result;
  }

  public getTenantMembers(tenantId: string): Array<{ userId: string; email: string; name: string; role: UserRole; joinedAt: string }> {
    this.syncIfDiskUpdated();
    return this.state.memberships
      .filter((m) => m.tenantId === tenantId)
      .map((m) => {
        const u = this.state.users[m.userId];
        return {
          userId: m.userId,
          email: u?.email || 'unknown',
          name: u?.name || 'Unknown Member',
          role: m.role,
          joinedAt: m.joinedAt,
        };
      });
  }

  public getTenantMembership(tenantId: string, userId: string): TenantMembership | null {
    this.syncIfDiskUpdated();
    return this.state.memberships.find((m) => m.tenantId === tenantId && m.userId === userId) || null;
  }

  public appendAudit(
    tenantId: string,
    actor: string,
    action: string,
    target: string,
    requestId: string
  ): TenantAuditEntry {
    if (!this.state.auditLogs[tenantId]) {
      this.state.auditLogs[tenantId] = [];
    }
    const chain = this.state.auditLogs[tenantId];
    const prevHash = chain.length > 0 ? chain[chain.length - 1].entryHash : GENESIS_HASH;
    const timestamp = new Date().toISOString();
    const entryHash = sha256Hex(`${timestamp}|${tenantId}|${actor}|${action}|${target}|${requestId}|${prevHash}`);

    const entry: TenantAuditEntry = {
      id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      tenantId,
      timestamp,
      actor,
      action,
      target,
      requestId,
      prevHash,
      entryHash,
    };

    chain.push(entry);
    if (chain.length > MAX_AUDIT_PER_TENANT) {
      chain.splice(0, chain.length - MAX_AUDIT_PER_TENANT);
    }
    this.persist();
    return entry;
  }

  public getAuditLogs(tenantId: string): { logs: TenantAuditEntry[]; chainValid: boolean } {
    this.syncIfDiskUpdated();
    const chain = this.state.auditLogs[tenantId] || [];
    let chainValid = true;
    for (let i = 0; i < chain.length; i++) {
      const curr = chain[i];
      const expectedPrev = i === 0 ? GENESIS_HASH : chain[i - 1].entryHash;
      if (curr.prevHash !== expectedPrev) {
        chainValid = false;
        break;
      }
      const recomputed = sha256Hex(
        `${curr.timestamp}|${curr.tenantId}|${curr.actor}|${curr.action}|${curr.target}|${curr.requestId}|${curr.prevHash}`
      );
      if (!timingSafeHexMatch(curr.entryHash, recomputed)) {
        chainValid = false;
        break;
      }
    }
    return { logs: [...chain].reverse(), chainValid };
  }

  public checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    const tracker = this.loginAttempts.get(key);
    if (!tracker) return { allowed: true, retryAfterSec: 0 };
    if (tracker.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((tracker.blockedUntil - now) / 1000)),
      };
    }
    if (now - tracker.lastAttemptAt > 15 * 60 * 1000) {
      this.loginAttempts.delete(key);
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  public recordLoginFailure(key: string): void {
    const now = Date.now();
    const existing = this.loginAttempts.get(key) || { failures: 0, blockedUntil: 0, lastAttemptAt: now };
    existing.failures += 1;
    existing.lastAttemptAt = now;
    if (existing.failures >= 5) {
      const backoffSec = Math.min(300, Math.pow(2, existing.failures - 4) * 5);
      existing.blockedUntil = now + backoffSec * 1000;
    }
    this.loginAttempts.set(key, existing);
  }

  public clearLoginFailures(key: string): void {
    this.loginAttempts.delete(key);
  }

  public registerUserAndWorkspace(params: {
    email: string;
    name: string;
    password: string;
    companyName?: string;
    inviteToken?: string;
    requestId: string;
    ipAddress?: string;
    userAgent?: string;
  }): {
    user: UserAccount;
    tenant: TenantWorkspace;
    role: UserRole;
    session: UserSession;
  } {
    this.syncIfDiskUpdated();
    const normalizedEmail = params.email.toLowerCase().trim();
    const existingUser = Object.values(this.state.users).find((u) => u.email === normalizedEmail);
    if (existingUser) {
      throw new Error('ACCOUNT_EXISTS');
    }

    const nowIso = new Date().toISOString();
    const userId = `usr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const newUser: UserAccount = {
      id: userId,
      email: normalizedEmail,
      name: params.name.trim(),
      passwordHash: hashPassword(params.password),
      createdAt: nowIso,
      lastLoginAt: nowIso,
      totpEnabled: false,
    };

    let targetTenant: TenantWorkspace;
    let assignedRole: UserRole = 'admin';

    if (params.inviteToken && params.inviteToken.trim()) {
      const tokenHash = sha256Hex(params.inviteToken.trim());
      const invite = this.state.invites.find(
        (inv) => !inv.usedAt && inv.expiresAt > Date.now() && timingSafeHexMatch(inv.tokenHash, tokenHash)
      );
      if (!invite || invite.email.toLowerCase() !== normalizedEmail) {
        throw new Error('INVALID_INVITE');
      }
      const existingTenant = this.state.tenants[invite.tenantId];
      if (!existingTenant || existingTenant.status !== 'active') {
        throw new Error('INVALID_INVITE');
      }
      invite.usedAt = nowIso;
      targetTenant = existingTenant;
      assignedRole = invite.role;
    } else {
      const orgName = (params.companyName || `${params.name.trim()} Workspace`).trim();
      const tenantId = `ten-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const baseSlug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'workspace';
      const defaultRateLimitRps = Math.max(
        10,
        Math.min(100000, Number(process.env.DEFAULT_TENANT_RATE_LIMIT_RPS || 1000) || 1000)
      );
      targetTenant = {
        tenantId,
        name: orgName,
        slug: `${baseSlug}-${tenantId.slice(-4)}`,
        status: 'active',
        ingestionPaused: false,
        ingestionRateLimitRps: defaultRateLimitRps,
        retentionTtlDays: 30,
        latencyWarnMs: 200,
        latencyCritMs: 300,
        errorRateThresholdPct: 5,
        createdAt: nowIso,
      };
      this.state.tenants[tenantId] = targetTenant;
      this.state.telemetryByTenant[tenantId] = [];
      this.state.apiKeys[tenantId] = [];
    }

    this.state.users[userId] = newUser;
    this.state.memberships.push({
      userId,
      tenantId: targetTenant.tenantId,
      role: assignedRole,
      joinedAt: nowIso,
    });

    const session = this.createSessionRecord(userId, targetTenant.tenantId, params.ipAddress, params.userAgent);
    this.appendAudit(
      targetTenant.tenantId,
      normalizedEmail,
      params.inviteToken ? 'INVITE_ACCEPTED' : 'WORKSPACE_CREATED',
      targetTenant.tenantId,
      params.requestId
    );
    this.persist();

    return { user: newUser, tenant: targetTenant, role: assignedRole, session };
  }

  public verifyUserMfaChallenge(
    user: UserAccount,
    totpCode?: string,
    recoveryCode?: string
  ): { ok: boolean; replayed?: boolean; method?: 'totp' | 'recovery' } {
    if (!user.totpEnabled || !user.totpSecretEncrypted) {
      return { ok: false };
    }

    if (totpCode && totpCode.trim()) {
      const secret = decryptSensitiveValue(user.totpSecretEncrypted, this.getSigningSecret());
      if (!secret) return { ok: false };
      const check = verifyTotpCodeWithWindow(secret, totpCode.trim(), user.lastTotpStepUsed);
      if (check.replayed) {
        return { ok: false, replayed: true };
      }
      if (check.valid && typeof check.matchedStep === 'number') {
        user.lastTotpStepUsed = check.matchedStep;
        this.persist();
        return { ok: true, method: 'totp' };
      }
    }

    if (recoveryCode && recoveryCode.trim() && Array.isArray(user.recoveryCodeHashes) && user.recoveryCodeHashes.length > 0) {
      const consumed = verifyAndConsumeRecoveryCode(recoveryCode.trim(), user.recoveryCodeHashes);
      if (consumed.matched) {
        user.recoveryCodeHashes = consumed.remainingHashes;
        this.persist();
        return { ok: true, method: 'recovery' };
      }
    }

    return { ok: false };
  }

  public authenticateLogin(params: {
    email: string;
    password: string;
    totpCode?: string;
    recoveryCode?: string;
    requestId: string;
    ipAddress?: string;
    userAgent?: string;
  }):
    | {
        status: 'AUTHENTICATED';
        user: UserAccount;
        tenant: TenantWorkspace;
        role: UserRole;
        session: UserSession;
      }
    | {
        status: 'MFA_REQUIRED' | 'INVALID_MFA' | 'INVALID_CREDENTIALS';
        replayed?: boolean;
      } {
    this.syncIfDiskUpdated();
    const normalizedEmail = params.email.toLowerCase().trim();
    const user = Object.values(this.state.users).find((u) => u.email === normalizedEmail);
    if (!user || !verifyPassword(params.password, user.passwordHash)) {
      return { status: 'INVALID_CREDENTIALS' };
    }

    const memberships = this.state.memberships.filter((m) => m.userId === user.id);
    const activeMembership = memberships.find((m) => this.state.tenants[m.tenantId]?.status === 'active');
    if (!activeMembership) {
      return { status: 'INVALID_CREDENTIALS' };
    }

    const tenant = this.state.tenants[activeMembership.tenantId];

    if (user.totpEnabled) {
      if (!params.totpCode?.trim() && !params.recoveryCode?.trim()) {
        return { status: 'MFA_REQUIRED' };
      }
      const mfaCheck = this.verifyUserMfaChallenge(user, params.totpCode, params.recoveryCode);
      if (!mfaCheck.ok) {
        return { status: 'INVALID_MFA', replayed: mfaCheck.replayed };
      }
      if (mfaCheck.method === 'recovery') {
        this.appendAudit(tenant.tenantId, user.email, 'MFA_RECOVERY_CODE_USED', user.id, params.requestId);
      }
    }

    user.lastLoginAt = new Date().toISOString();
    const session = this.createSessionRecord(user.id, tenant.tenantId, params.ipAddress, params.userAgent);
    this.appendAudit(tenant.tenantId, user.email, 'USER_SIGN_IN', session.sessionId.slice(0, 12), params.requestId);
    this.persist();

    return { status: 'AUTHENTICATED', user, tenant, role: activeMembership.role, session };
  }

  public beginTotpEnrollment(
    userId: string,
    tenantId: string,
    requestId: string
  ): { secret: string; otpauthUri: string } | null {
    this.syncIfDiskUpdated();
    const user = this.state.users[userId];
    if (!user) return null;

    const secret = generateTotpSecret();
    user.pendingTotpSecretEncrypted = encryptSensitiveValue(secret, this.getSigningSecret());
    this.appendAudit(tenantId, user.email, 'TOTP_ENROLLMENT_STARTED', user.id, requestId);
    this.persist();

    return {
      secret,
      otpauthUri: buildTotpOtpAuthUri({
        issuer: 'The Neon Chasm',
        accountEmail: user.email,
        secret,
      }),
    };
  }

  public confirmTotpEnrollment(
    userId: string,
    tenantId: string,
    code: string,
    requestId: string
  ): { ok: boolean; recoveryCodes?: string[]; error?: string } {
    this.syncIfDiskUpdated();
    const user = this.state.users[userId];
    if (!user || !user.pendingTotpSecretEncrypted) {
      return { ok: false, error: 'No pending TOTP enrollment found. Start MFA setup first.' };
    }

    const secret = decryptSensitiveValue(user.pendingTotpSecretEncrypted, this.getSigningSecret());
    if (!secret) {
      return { ok: false, error: 'Unable to decrypt pending TOTP secret.' };
    }

    const check = verifyTotpCodeWithWindow(secret, code.trim(), user.lastTotpStepUsed);
    if (check.replayed) {
      return { ok: false, error: 'TOTP code already used in this time window. Wait for next code.' };
    }
    if (!check.valid || typeof check.matchedStep !== 'number') {
      return { ok: false, error: 'Invalid 6-digit TOTP authenticator verification code.' };
    }

    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);
    user.totpSecretEncrypted = user.pendingTotpSecretEncrypted;
    delete user.pendingTotpSecretEncrypted;
    user.totpEnabled = true;
    user.lastTotpStepUsed = check.matchedStep;
    user.recoveryCodeHashes = hashedCodes;
    this.appendAudit(tenantId, user.email, 'TOTP_MFA_ENABLED', user.id, requestId);
    this.persist();

    return { ok: true, recoveryCodes: plainCodes };
  }

  public disableTotp(userId: string, tenantId: string, requestId: string): boolean {
    this.syncIfDiskUpdated();
    const user = this.state.users[userId];
    if (!user) return false;
    user.totpEnabled = false;
    delete user.totpSecretEncrypted;
    delete user.pendingTotpSecretEncrypted;
    delete user.recoveryCodeHashes;
    delete user.lastTotpStepUsed;
    this.appendAudit(tenantId, user.email, 'TOTP_MFA_DISABLED', user.id, requestId);
    this.persist();
    return true;
  }

  public regenerateRecoveryCodes(userId: string, tenantId: string, requestId: string): string[] | null {
    this.syncIfDiskUpdated();
    const user = this.state.users[userId];
    if (!user || !user.totpEnabled) return null;
    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);
    user.recoveryCodeHashes = hashedCodes;
    this.appendAudit(tenantId, user.email, 'MFA_RECOVERY_CODES_REGENERATED', user.id, requestId);
    this.persist();
    return plainCodes;
  }

  public changeUserPassword(params: {
    userId: string;
    currentSessionId: string;
    currentPassword: string;
    newPassword: string;
    tenantId: string;
    requestId: string;
  }): { ok: boolean; error?: string; code?: string } {
    this.syncIfDiskUpdated();
    const user = this.state.users[params.userId];
    if (!user) {
      return { ok: false, error: 'Account not found.', code: 'NOT_FOUND' };
    }
    if (!verifyPassword(params.currentPassword, user.passwordHash)) {
      return { ok: false, error: 'Current password is incorrect.', code: 'INVALID_CREDENTIALS' };
    }

    user.passwordHash = hashPassword(params.newPassword);
    // Revoke all other sessions on password change
    for (const [sid, sess] of Object.entries(this.state.sessions)) {
      if (sess.userId === params.userId && sid !== params.currentSessionId) {
        delete this.state.sessions[sid];
      }
    }
    const currSess = this.state.sessions[params.currentSessionId];
    if (currSess) {
      currSess.stepUpVerifiedUntil = Date.now() + STEP_UP_TTL_MS;
    }

    this.appendAudit(params.tenantId, user.email, 'USER_PASSWORD_CHANGED', user.id, params.requestId);
    this.persist();
    return { ok: true };
  }

  public verifyStepUp(params: {
    sessionId: string;
    userId: string;
    tenantId: string;
    password?: string;
    totpCode?: string;
    recoveryCode?: string;
    requestId: string;
  }): { ok: boolean; stepUpVerifiedUntil?: number; error?: string } {
    this.syncIfDiskUpdated();
    const user = this.state.users[params.userId];
    const session = this.state.sessions[params.sessionId];
    if (!user || !session) {
      return { ok: false, error: 'Active session not found.' };
    }

    let verified = false;
    if (params.password && params.password.length > 0) {
      verified = verifyPassword(params.password, user.passwordHash);
    } else if ((params.totpCode || params.recoveryCode) && user.totpEnabled) {
      const mfaCheck = this.verifyUserMfaChallenge(user, params.totpCode, params.recoveryCode);
      if (mfaCheck.replayed) {
        return { ok: false, error: 'TOTP code already used in this window. Wait for the next code.' };
      }
      verified = mfaCheck.ok;
    }

    if (!verified) {
      return { ok: false, error: 'Invalid step-up verification credentials.' };
    }

    const until = Date.now() + STEP_UP_TTL_MS;
    session.stepUpVerifiedUntil = until;
    this.appendAudit(params.tenantId, user.email, 'STEP_UP_VERIFIED', session.sessionId.slice(0, 12), params.requestId);
    this.persist();
    return { ok: true, stepUpVerifiedUntil: until };
  }

  public isStepUpActive(session: UserSession): boolean {
    return Boolean(session.stepUpVerifiedUntil && session.stepUpVerifiedUntil > Date.now());
  }

  private createSessionRecord(userId: string, tenantId: string, ipAddress?: string, userAgent?: string): UserSession {
    const rawId = `ses_${crypto.randomBytes(24).toString('hex')}`;
    const now = Date.now();
    const session: UserSession = {
      sessionId: rawId,
      userId,
      tenantId,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + SESSION_ABSOLUTE_TTL_MS,
      idleExpiresAt: now + SESSION_IDLE_TTL_MS,
      ipAddress,
      userAgent,
    };
    this.state.sessions[rawId] = session;
    return session;
  }

  public createSignedCookieToken(sessionId: string): string {
    const sig = crypto
      .createHmac('sha256', this.getSigningSecret())
      .update(sessionId)
      .digest('hex');
    return `${sessionId}.${sig}`;
  }

  public verifySignedCookieToken(token?: string): string | null {
    if (!token) return null;
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx <= 0) return null;
    const sessionId = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const expected = crypto
      .createHmac('sha256', this.getSigningSecret())
      .update(sessionId)
      .digest('hex');
    if (!timingSafeHexMatch(sig, expected)) return null;
    return sessionId;
  }

  public resolveSessionFromRequest(req: NextRequest): {
    user: UserAccount;
    session: UserSession;
    tenant: TenantWorkspace;
    role: UserRole;
  } | null {
    this.syncIfDiskUpdated();
    const cookieVal = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    let sessionId: string | null = null;
    try {
      sessionId = this.verifySignedCookieToken(cookieVal);
    } catch {
      this.recordAuthCheck(false);
      return null;
    }

    if (!sessionId) {
      if (cookieVal) this.recordAuthCheck(false);
      return null;
    }

    const session = this.state.sessions[sessionId];
    const now = Date.now();

    if (
      !session ||
      now > session.expiresAt ||
      (typeof session.idleExpiresAt === 'number' && now > session.idleExpiresAt)
    ) {
      if (session) {
        delete this.state.sessions[sessionId];
        this.persist();
      }
      this.recordAuthCheck(false);
      return null;
    }

    const user = this.state.users[session.userId];
    const tenant = this.state.tenants[session.tenantId];
    if (!user || !tenant || tenant.status !== 'active') {
      if (session) {
        delete this.state.sessions[sessionId];
        this.persist();
      }
      this.recordAuthCheck(false);
      return null;
    }

    const membership = this.state.memberships.find(
      (m) => m.userId === user.id && m.tenantId === tenant.tenantId
    );
    if (!membership) {
      this.recordAuthCheck(false);
      return null;
    }

    // Slide idle expiration cleanly without unnecessary fsync on rapid sub-minute polls
    const prevIdle = session.idleExpiresAt || now;
    const nextIdle = Math.min(session.expiresAt, now + SESSION_IDLE_TTL_MS);
    session.idleExpiresAt = nextIdle;
    if (nextIdle - prevIdle > 60_000) {
      this.persist();
    }

    this.recordAuthCheck(true);
    return { user, session, tenant, role: membership.role };
  }

  public revokeSession(sessionId: string, requestId: string): void {
    this.syncIfDiskUpdated();
    const sess = this.state.sessions[sessionId];
    if (!sess) return;
    const user = this.state.users[sess.userId];
    delete this.state.sessions[sessionId];
    this.appendAudit(sess.tenantId, user?.email || sess.userId, 'USER_SIGN_OUT', sessionId.slice(0, 12), requestId);
    this.persist();
  }

  public revokeUserSessions(userId: string): void {
    this.syncIfDiskUpdated();
    for (const [sid, sess] of Object.entries(this.state.sessions)) {
      if (sess.userId === userId) {
        delete this.state.sessions[sid];
      }
    }
    this.persist();
  }

  public listUserSessions(
    userId: string,
    currentSessionId?: string
  ): Array<Omit<UserSession, 'sessionId'> & { idPrefix: string; isCurrent: boolean }> {
    this.syncIfDiskUpdated();
    const now = Date.now();
    return Object.values(this.state.sessions)
      .filter((s) => s.userId === userId && s.expiresAt > now && (!s.idleExpiresAt || s.idleExpiresAt > now))
      .map((s) => ({
        idPrefix: s.sessionId.slice(0, 12),
        userId: s.userId,
        tenantId: s.tenantId,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        idleExpiresAt: s.idleExpiresAt || s.expiresAt,
        stepUpVerifiedUntil: s.stepUpVerifiedUntil,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        isCurrent: Boolean(currentSessionId && s.sessionId === currentSessionId),
      }));
  }

  public terminateSessionByPrefix(userId: string, idPrefix: string, requestId: string): boolean {
    this.syncIfDiskUpdated();
    for (const [sid, sess] of Object.entries(this.state.sessions)) {
      if (sess.userId === userId && sid.startsWith(idPrefix)) {
        const user = this.state.users[userId];
        delete this.state.sessions[sid];
        this.appendAudit(sess.tenantId, user?.email || userId, 'SESSION_TERMINATED', idPrefix, requestId);
        this.persist();
        return true;
      }
    }
    return false;
  }

  public switchActiveTenant(
    session: UserSession,
    targetTenantId: string,
    requestId: string
  ): { tenant: TenantWorkspace; role: UserRole } | null {
    this.syncIfDiskUpdated();
    const liveSession = this.state.sessions[session.sessionId] || session;
    const membership = this.state.memberships.find(
      (m) => m.userId === liveSession.userId && m.tenantId === targetTenantId
    );
    const tenant = this.state.tenants[targetTenantId];
    if (!membership || !tenant || tenant.status !== 'active') {
      return null;
    }
    liveSession.tenantId = targetTenantId;
    this.state.sessions[liveSession.sessionId] = liveSession;
    const user = this.state.users[liveSession.userId];
    this.appendAudit(targetTenantId, user?.email || liveSession.userId, 'WORKSPACE_SWITCH', targetTenantId, requestId);
    this.persist();
    return { tenant, role: membership.role };
  }

  public createWorkspaceForUser(params: {
    userId: string;
    companyName: string;
    requestId: string;
  }): { tenant: TenantWorkspace; role: UserRole } {
    this.syncIfDiskUpdated();
    const nowIso = new Date().toISOString();
    const orgName = params.companyName.trim();
    const tenantId = `ten-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const baseSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'workspace';

    const defaultRateLimitRps = Math.max(
      10,
      Math.min(100000, Number(process.env.DEFAULT_TENANT_RATE_LIMIT_RPS || 1000) || 1000)
    );
    const tenant: TenantWorkspace = {
      tenantId,
      name: orgName,
      slug: `${baseSlug}-${tenantId.slice(-4)}`,
      status: 'active',
      ingestionPaused: false,
      ingestionRateLimitRps: defaultRateLimitRps,
      retentionTtlDays: 30,
      latencyWarnMs: 200,
      latencyCritMs: 300,
      errorRateThresholdPct: 5,
      createdAt: nowIso,
    };

    this.state.tenants[tenantId] = tenant;
    this.state.telemetryByTenant[tenantId] = [];
    this.state.apiKeys[tenantId] = [];
    this.state.memberships.push({
      userId: params.userId,
      tenantId,
      role: 'admin',
      joinedAt: nowIso,
    });

    const user = this.state.users[params.userId];
    this.appendAudit(tenantId, user?.email || params.userId, 'WORKSPACE_CREATED', tenantId, params.requestId);
    this.persist();
    return { tenant, role: 'admin' };
  }

  public deactivateTenantWorkspace(
    tenantId: string,
    actorEmail: string,
    requestId: string
  ): { ok: boolean; deactivatedTenant?: TenantWorkspace } {
    this.syncIfDiskUpdated();
    const tenant = this.state.tenants[tenantId];
    if (!tenant || tenant.status === 'deactivated') {
      return { ok: false };
    }
    tenant.status = 'deactivated';
    tenant.ingestionPaused = true;

    // Revoke all sessions bound to this deactivated tenant
    for (const [sid, sess] of Object.entries(this.state.sessions)) {
      if (sess.tenantId === tenantId) {
        delete this.state.sessions[sid];
      }
    }

    // Revoke active API keys in this tenant
    for (const key of this.state.apiKeys[tenantId] || []) {
      if (!key.revokedAt) {
        key.revokedAt = new Date().toISOString();
      }
    }

    this.appendAudit(tenantId, actorEmail, 'WORKSPACE_DEACTIVATED', tenantId, requestId);
    this.persist();
    return { ok: true, deactivatedTenant: tenant };
  }

  public getMaskedWebhookUrl(tenant: TenantWorkspace): string | null {
    if (!tenant.webhookUrlEncrypted) return null;
    try {
      const plain = decryptSensitiveValue(tenant.webhookUrlEncrypted, this.getSigningSecret());
      return plain ? maskSecretUrl(plain) : null;
    } catch {
      return null;
    }
  }

  public updateTenantConfig(
    tenantId: string,
    actorEmail: string,
    updates: Partial<
      Pick<
        TenantWorkspace,
        | 'ingestionPaused'
        | 'retentionTtlDays'
        | 'ingestionRateLimitRps'
        | 'latencyWarnMs'
        | 'latencyCritMs'
        | 'errorRateThresholdPct'
        | 'name'
      >
    > & { webhookUrl?: string },
    requestId: string
  ): TenantWorkspace | null {
    this.syncIfDiskUpdated();
    const tenant = this.state.tenants[tenantId];
    if (!tenant) return null;

    const { webhookUrl, ...scalarUpdates } = updates;
    Object.assign(tenant, scalarUpdates);

    const auditedKeys = Object.keys(scalarUpdates);
    if (webhookUrl !== undefined) {
      const trimmed = webhookUrl.trim();
      if (!trimmed) {
        delete tenant.webhookUrlEncrypted;
      } else {
        tenant.webhookUrlEncrypted = encryptSensitiveValue(trimmed, this.getSigningSecret());
      }
      auditedKeys.push('webhookUrlEncrypted');
    }

    this.appendAudit(tenantId, actorEmail, 'TENANT_CONFIG_UPDATED', JSON.stringify(auditedKeys), requestId);
    this.persist();
    return tenant;
  }

  public createApiKey(params: {
    tenantId: string;
    name: string;
    scopes: ApiKeyScope[];
    allowedCidrs?: string[];
    expiresAt?: string;
    actorEmail: string;
    requestId: string;
  }): { record: Omit<ApiKeyRecord, 'hash'>; plainSecret: string } {
    this.syncIfDiskUpdated();
    const plainSecret = `nc_live_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = plainSecret.slice(0, 12);
    const keyHash = sha256Hex(plainSecret);

    const record: ApiKeyRecord = {
      keyId: `key-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      tenantId: params.tenantId,
      name: params.name.trim(),
      prefix,
      hash: keyHash,
      scopes: params.scopes.length > 0 ? params.scopes : ['ingest:write'],
      allowedCidrs: params.allowedCidrs && params.allowedCidrs.length > 0 ? params.allowedCidrs : undefined,
      expiresAt: params.expiresAt,
      createdAt: new Date().toISOString(),
    };

    if (!this.state.apiKeys[params.tenantId]) {
      this.state.apiKeys[params.tenantId] = [];
    }
    this.state.apiKeys[params.tenantId].push(record);
    this.appendAudit(params.tenantId, params.actorEmail, 'API_KEY_CREATED', `${record.keyId} (${prefix})`, params.requestId);
    this.persist();

    const { hash: _ignored, ...safeRecord } = record;
    void _ignored;
    return { record: safeRecord, plainSecret };
  }

  public rotateApiKey(params: {
    tenantId: string;
    keyId: string;
    graceMinutes?: number;
    actorEmail: string;
    requestId: string;
  }): { record: Omit<ApiKeyRecord, 'hash'>; plainSecret: string; previousGraceExpiresAt: string } | null {
    this.syncIfDiskUpdated();
    const list = this.state.apiKeys[params.tenantId] || [];
    const oldKey = list.find((k) => k.keyId === params.keyId && !k.revokedAt);
    if (!oldKey) return null;

    const graceMs = Math.max(1, Math.min(1440, params.graceMinutes ?? 60)) * 60 * 1000;
    oldKey.graceExpiresAt = Date.now() + graceMs;

    const plainSecret = `nc_live_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = plainSecret.slice(0, 12);
    const newRecord: ApiKeyRecord = {
      keyId: `key-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      tenantId: params.tenantId,
      name: `${oldKey.name} (Rotated)`,
      prefix,
      hash: sha256Hex(plainSecret),
      scopes: [...oldKey.scopes],
      allowedCidrs: oldKey.allowedCidrs ? [...oldKey.allowedCidrs] : undefined,
      expiresAt: oldKey.expiresAt,
      createdAt: new Date().toISOString(),
    };
    list.push(newRecord);
    this.appendAudit(
      params.tenantId,
      params.actorEmail,
      'API_KEY_ROTATED',
      `${oldKey.keyId} -> ${newRecord.keyId}`,
      params.requestId
    );
    this.persist();

    const { hash: _ignored, ...safeRecord } = newRecord;
    void _ignored;
    return {
      record: safeRecord,
      plainSecret,
      previousGraceExpiresAt: new Date(oldKey.graceExpiresAt).toISOString(),
    };
  }

  public revokeApiKey(tenantId: string, keyId: string, actorEmail: string, requestId: string): boolean {
    this.syncIfDiskUpdated();
    const list = this.state.apiKeys[tenantId] || [];
    const target = list.find((k) => k.keyId === keyId);
    if (!target || target.revokedAt) return false;
    target.revokedAt = new Date().toISOString();
    this.appendAudit(tenantId, actorEmail, 'API_KEY_REVOKED', `${keyId} (${target.prefix})`, requestId);
    this.persist();
    return true;
  }

  public listApiKeys(tenantId: string): Array<Omit<ApiKeyRecord, 'hash'>> {
    this.syncIfDiskUpdated();
    return (this.state.apiKeys[tenantId] || []).map(({ hash: _h, ...rest }) => {
      void _h;
      return rest;
    });
  }

  public verifyApiKey(
    rawSecret: string,
    requiredScope: ApiKeyScope,
    requestedTenantId?: string,
    clientIp?: string
  ): { tenant: TenantWorkspace; key: ApiKeyRecord } | { denied: 'SCOPE' | 'CIDR' | 'EXPIRED' } | null {
    this.syncIfDiskUpdated();
    const presentedHash = sha256Hex(rawSecret.trim());
    const now = Date.now();

    for (const [tId, keys] of Object.entries(this.state.apiKeys)) {
      if (requestedTenantId && requestedTenantId !== tId) continue;
      for (const k of keys) {
        if (k.revokedAt) continue;
        if (!timingSafeHexMatch(k.hash, presentedHash)) continue;
        if (!k.scopes.includes(requiredScope)) {
          this.recordAuthCheck(false);
          return { denied: 'SCOPE' };
        }
        if (k.expiresAt && new Date(k.expiresAt).getTime() <= now) {
          this.recordAuthCheck(false);
          return { denied: 'EXPIRED' };
        }
        if (k.graceExpiresAt && k.graceExpiresAt <= now) {
          this.recordAuthCheck(false);
          return { denied: 'EXPIRED' };
        }
        if (!isIpInAllowlist(clientIp, k.allowedCidrs)) {
          this.recordAuthCheck(false);
          return { denied: 'CIDR' };
        }
        const tenant = this.state.tenants[tId];
        if (!tenant || tenant.status !== 'active') {
          this.recordAuthCheck(false);
          return null;
        }
        this.recordAuthCheck(true);
        return { tenant, key: k };
      }
    }
    this.recordAuthCheck(false);
    return null;
  }

  public createInvite(params: {
    tenantId: string;
    email: string;
    role: UserRole;
    actorEmail: string;
    requestId: string;
  }): { inviteId: string; inviteToken: string; expiresAt: string } {
    this.syncIfDiskUpdated();
    const inviteToken = `nci_${crypto.randomBytes(18).toString('hex')}`;
    const expiresAt = Date.now() + 1000 * 60 * 60 * 48; // 48h
    const inviteId = `inv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    this.state.invites.push({
      inviteId,
      tenantId: params.tenantId,
      email: params.email.toLowerCase().trim(),
      role: params.role,
      tokenHash: sha256Hex(inviteToken),
      expiresAt,
      createdBy: params.actorEmail,
      createdAt: new Date().toISOString(),
    });
    this.appendAudit(params.tenantId, params.actorEmail, 'MEMBER_INVITE_CREATED', `${params.email} (${params.role})`, params.requestId);
    this.persist();
    return { inviteId, inviteToken, expiresAt: new Date(expiresAt).toISOString() };
  }

  public updateMemberRole(params: {
    tenantId: string;
    targetUserId: string;
    newRole: UserRole;
    actorEmail: string;
    requestId: string;
  }): { ok: boolean; error?: string; code?: string } {
    this.syncIfDiskUpdated();
    const membership = this.state.memberships.find(
      (m) => m.tenantId === params.tenantId && m.userId === params.targetUserId
    );
    if (!membership) {
      return { ok: false, error: 'Member not found in tenant.', code: 'NOT_FOUND' };
    }

    if (membership.role === 'admin' && params.newRole !== 'admin') {
      const adminCount = this.state.memberships.filter(
        (m) => m.tenantId === params.tenantId && m.role === 'admin'
      ).length;
      if (adminCount <= 1) {
        return {
          ok: false,
          error: 'Last-admin protection: cannot demote the sole remaining administrator of this organization.',
          code: 'LAST_ADMIN_LOCKOUT',
        };
      }
    }

    membership.role = params.newRole;
    this.revokeUserSessions(params.targetUserId);
    this.appendAudit(params.tenantId, params.actorEmail, 'MEMBER_ROLE_UPDATED', `${params.targetUserId} -> ${params.newRole}`, params.requestId);
    this.persist();
    return { ok: true };
  }

  public removeMemberFromTenant(params: {
    tenantId: string;
    targetUserId: string;
    actorEmail: string;
    requestId: string;
  }): { ok: boolean; error?: string; code?: string } {
    this.syncIfDiskUpdated();
    const idx = this.state.memberships.findIndex(
      (m) => m.tenantId === params.tenantId && m.userId === params.targetUserId
    );
    if (idx === -1) {
      return { ok: false, error: 'Member not found in tenant.', code: 'NOT_FOUND' };
    }
    const target = this.state.memberships[idx];
    if (target.role === 'admin') {
      const adminCount = this.state.memberships.filter(
        (m) => m.tenantId === params.tenantId && m.role === 'admin'
      ).length;
      if (adminCount <= 1) {
        return {
          ok: false,
          error: 'Last-admin protection: cannot remove the sole remaining administrator.',
          code: 'LAST_ADMIN_LOCKOUT',
        };
      }
    }

    this.state.memberships.splice(idx, 1);
    for (const [sid, sess] of Object.entries(this.state.sessions)) {
      if (sess.userId === params.targetUserId && sess.tenantId === params.tenantId) {
        delete this.state.sessions[sid];
      }
    }

    this.appendAudit(params.tenantId, params.actorEmail, 'MEMBER_REMOVED', params.targetUserId, params.requestId);
    this.persist();
    return { ok: true };
  }

  public consumeTenantRateLimit(tenant: TenantWorkspace): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    const maxTokens = Math.max(10, tenant.ingestionRateLimitRps);
    const bucket = this.rateBuckets.get(tenant.tenantId) || {
      tokens: maxTokens,
      lastRefillMs: now,
    };
    const elapsedSec = (now - bucket.lastRefillMs) / 1000;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsedSec * maxTokens);
    bucket.lastRefillMs = now;

    if (bucket.tokens < 1) {
      this.rateBuckets.set(tenant.tenantId, bucket);
      return { allowed: false, retryAfterSec: 1 };
    }
    bucket.tokens -= 1;
    this.rateBuckets.set(tenant.tenantId, bucket);
    return { allowed: true, retryAfterSec: 0 };
  }

  public isDuplicateIngest(tenantId: string, dedupKey: string): boolean {
    const now = Date.now();
    if (this.recentDedupKeys.size > 5000) {
      for (const [k, ts] of this.recentDedupKeys.entries()) {
        if (now - ts > 60000) this.recentDedupKeys.delete(k);
      }
    }
    const composite = `${tenantId}:${dedupKey}`;
    const prev = this.recentDedupKeys.get(composite);
    if (prev && now - prev < 30000) {
      return true;
    }
    this.recentDedupKeys.set(composite, now);
    return false;
  }

  public recordAuthCheck(allowed: boolean): void {
    this.authChecksTotal += 1;
    if (!allowed) {
      this.authChecksDenied += 1;
    }
  }

  public recordRedactedSecrets(count: number): void {
    if (count > 0) {
      this.redactedSecretsTotal += count;
    }
  }

  public subscribeTenantTelemetry(
    tenantId: string,
    listener: (records: TelemetryRecord[]) => void
  ): { ok: true; unsubscribe: () => void } | { ok: false; reason: 'TENANT_SSE_LIMIT' | 'GLOBAL_SSE_LIMIT' } {
    let globalCount = 0;
    for (const listeners of this.sseSubscribers.values()) {
      globalCount += listeners.size;
    }
    if (globalCount >= MAX_SSE_GLOBAL) {
      return { ok: false, reason: 'GLOBAL_SSE_LIMIT' };
    }

    let set = this.sseSubscribers.get(tenantId);
    if (set && set.size >= MAX_SSE_PER_TENANT) {
      return { ok: false, reason: 'TENANT_SSE_LIMIT' };
    }

    if (!set) {
      set = new Set();
      this.sseSubscribers.set(tenantId, set);
    }
    set.add(listener);

    return {
      ok: true,
      unsubscribe: () => {
        const current = this.sseSubscribers.get(tenantId);
        if (current) {
          current.delete(listener);
          if (current.size === 0) {
            this.sseSubscribers.delete(tenantId);
          }
        }
      },
    };
  }

  private publishTenantTelemetry(tenantId: string, records: TelemetryRecord[]): void {
    const listeners = this.sseSubscribers.get(tenantId);
    if (!listeners || listeners.size === 0 || records.length === 0) return;
    for (const fn of listeners) {
      try {
        fn(records);
      } catch {
        // Ignore disconnected subscriber cleanup race
      }
    }
  }

  public getPlatformDiagnostics(): PlatformDiagnosticsSnapshot {
    this.syncIfDiskUpdated();
    const now = Date.now();
    this.ingestWindowTimestamps = this.ingestWindowTimestamps.filter((ts) => now - ts <= 10000);

    let activeSseSubscribers = 0;
    for (const listeners of this.sseSubscribers.values()) {
      activeSseSubscribers += listeners.size;
    }

    let totalBufferedRecords = 0;
    let estimatedBufferBytes = 0;
    for (const list of Object.values(this.state.telemetryByTenant)) {
      totalBufferedRecords += list.length;
      if (list.length > 0) {
        estimatedBufferBytes += Buffer.byteLength(JSON.stringify(list), 'utf8');
      }
    }

    return {
      activeSseSubscribers,
      totalTenants: Object.keys(this.state.tenants).length,
      totalUsers: Object.keys(this.state.users).length,
      totalBufferedRecords,
      estimatedBufferBytes,
      authChecksTotal: this.authChecksTotal,
      authChecksDenied: this.authChecksDenied,
      totalIngestBatches: this.totalIngestBatches,
      totalIngestedRecords: this.totalIngestedRecords,
      redactedSecretsTotal: this.redactedSecretsTotal,
      ingestionEventsPerSec: Number((this.ingestWindowTimestamps.length / 10).toFixed(2)),
      uptimeSeconds: Math.floor((now - this.startedAtMs) / 1000),
    };
  }

  public appendTelemetryRecords(tenantId: string, records: TelemetryRecord[]): number {
    this.syncIfDiskUpdated();
    if (!this.state.telemetryByTenant[tenantId]) {
      this.state.telemetryByTenant[tenantId] = [];
    }
    const tenant = this.state.tenants[tenantId];
    const ttlMs = (tenant?.retentionTtlDays || 30) * 86400000;
    const cutoff = Date.now() - ttlMs;

    const current = this.state.telemetryByTenant[tenantId].filter((r) => r.timestamp >= cutoff);
    current.push(...records);
    this.state.telemetryByTenant[tenantId] = current.slice(-MAX_RECORDS_PER_TENANT);
    this.totalIngestBatches += 1;
    this.totalIngestedRecords += records.length;
    const now = Date.now();
    for (let i = 0; i < records.length; i++) {
      this.ingestWindowTimestamps.push(now);
    }
    this.ingestWindowTimestamps = this.ingestWindowTimestamps.filter((ts) => now - ts <= 10000);
    this.persist();
    this.publishTenantTelemetry(tenantId, records);
    return records.length;
  }

  public getTelemetryRecords(tenantId: string, limit = 200): TelemetryRecord[] {
    this.syncIfDiskUpdated();
    const tenant = this.state.tenants[tenantId];
    const ttlMs = (tenant?.retentionTtlDays || 30) * 86400000;
    const cutoff = Date.now() - ttlMs;
    const list = (this.state.telemetryByTenant[tenantId] || []).filter((r) => r.timestamp >= cutoff);
    return list.slice(-limit);
  }

  public purgeTelemetryRecords(tenantId: string, actorEmail: string, requestId: string): number {
    this.syncIfDiskUpdated();
    const count = (this.state.telemetryByTenant[tenantId] || []).length;
    this.state.telemetryByTenant[tenantId] = [];
    this.appendAudit(tenantId, actorEmail, 'TENANT_TELEMETRY_PURGED', `purged=${count}`, requestId);
    this.persist();
    return count;
  }

  public getDashboardPresets(tenantId: string): unknown[] {
    this.syncIfDiskUpdated();
    return this.state.dashboardPresetsByTenant[tenantId] || [];
  }

  public saveDashboardPreset(tenantId: string, preset: Record<string, unknown>, actorEmail: string, requestId: string): unknown[] {
    this.syncIfDiskUpdated();
    const list = this.state.dashboardPresetsByTenant[tenantId] || [];
    const next = [preset, ...list.filter((p) => (p as Record<string, unknown>).id !== preset.id)];
    this.state.dashboardPresetsByTenant[tenantId] = next;
    this.appendAudit(tenantId, actorEmail, 'DASHBOARD_PRESET_SAVED', String(preset.id || 'preset'), requestId);
    this.persist();
    return next;
  }

  public deleteDashboardPreset(tenantId: string, presetId: string, actorEmail: string, requestId: string): boolean {
    this.syncIfDiskUpdated();
    const list = this.state.dashboardPresetsByTenant[tenantId] || [];
    const next = list.filter((p) => (p as Record<string, unknown>).id !== presetId);
    if (next.length === list.length) return false;
    this.state.dashboardPresetsByTenant[tenantId] = next;
    this.appendAudit(tenantId, actorEmail, 'DASHBOARD_PRESET_DELETED', presetId, requestId);
    this.persist();
    return true;
  }
}

export function getAuthStore(): AuthStoreManager {
  if (!globalForAuth.__neonChasmAuthStore) {
    globalForAuth.__neonChasmAuthStore = new AuthStoreManager();
  }
  return globalForAuth.__neonChasmAuthStore;
}

function isHttpsRequest(req: NextRequest): boolean {
  const forwardedProto = req.headers.get('x-forwarded-proto')?.toLowerCase() || '';
  if (forwardedProto.includes('https')) return true;
  if (req.nextUrl.protocol === 'https:') return true;
  const origin = req.headers.get('origin')?.toLowerCase() || '';
  if (origin.startsWith('https://')) return true;
  const referer = req.headers.get('referer')?.toLowerCase() || '';
  if (referer.startsWith('https://')) return true;
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  if (host.endsWith('.run.app') || host.endsWith('.googleusercontent.com')) return true;
  return false;
}

export function setSessionCookie(res: NextResponse, req: NextRequest, signedToken: string): void {
  const isHttps = isHttpsRequest(req);
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: signedToken,
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    partitioned: isHttps,
    path: '/',
    maxAge: Math.floor(SESSION_ABSOLUTE_TTL_MS / 1000),
  });
}

export function clearSessionCookie(res: NextResponse, req: NextRequest): void {
  const isHttps = isHttpsRequest(req);
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    partitioned: isHttps,
    path: '/',
    maxAge: 0,
  });
}

export function validateCsrfOrigin(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const candidateHosts = [
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim(),
    req.headers.get('host')?.trim(),
    req.nextUrl.host?.trim(),
  ].filter((h): h is string => Boolean(h));
  if (candidateHosts.length === 0) return true;
  try {
    const originHost = new URL(origin).host;
    return candidateHosts.includes(originHost);
  } catch {
    return false;
  }
}

export function getPrivateHeaders(requestId: string, tenantId?: string): Record<string, string> {
  return {
    'X-Request-ID': requestId,
    'Cache-Control': 'private, no-store, max-age=0',
    Vary: 'Cookie, Authorization, X-Tenant-ID',
    ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
  };
}

export function sanitizeUser(user: UserAccount) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    totpEnabled: Boolean(user.totpEnabled),
    recoveryCodesRemaining: user.recoveryCodeHashes?.length ?? 0,
  };
}

export function sanitizeTenantWorkspace(tenant: TenantWorkspace, role?: UserRole) {
  const maskedWebhookUrl = getAuthStore().getMaskedWebhookUrl(tenant);
  return {
    tenantId: tenant.tenantId,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    ingestionPaused: tenant.ingestionPaused,
    ingestionRateLimitRps: tenant.ingestionRateLimitRps,
    retentionTtlDays: tenant.retentionTtlDays,
    latencyWarnMs: tenant.latencyWarnMs,
    latencyCritMs: tenant.latencyCritMs,
    errorRateThresholdPct: tenant.errorRateThresholdPct,
    hasWebhookUrl: Boolean(tenant.webhookUrlEncrypted),
    maskedWebhookUrl,
    createdAt: tenant.createdAt,
    ...(role ? { role } : {}),
  };
}
