/**
 * Production-Grade Multi-Tenant Authentication, RBAC & API Key Security Engine
 */

import crypto from 'crypto';
import { statePersistence } from '../storage/statePersistence';

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // scrypt salt$hash
  createdAt: number;
  lastLoginAt: number;
}

export interface TenantWorkspace {
  tenantId: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  ingestionPaused: boolean;
  ingestionRateLimitRps: number;
  retentionTtlDays: number;
  createdAt: number;
}

export interface TenantMembership {
  userId: string;
  tenantId: string;
  role: UserRole;
  joinedAt: number;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  createdAt: number;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApiKeyRecord {
  keyId: string;
  tenantId: string;
  name: string;
  prefix: string; // e.g. nc_live_xxxx
  hash: string; // SHA-256 of full key
  scopes: ('ingest:write' | 'telemetry:read')[];
  expiresAt?: number;
  graceExpiresAt?: number; // for zero-downtime rotation grace window
  createdAt: number;
  revokedAt?: number;
}

export interface AuthDatabaseState {
  users: Record<string, UserAccount>;
  tenants: Record<string, TenantWorkspace>;
  memberships: TenantMembership[];
  sessions: Record<string, UserSession>;
  apiKeys: Record<string, ApiKeyRecord[]>;
}

const INITIAL_AUTH_STATE: AuthDatabaseState = {
  users: {},
  tenants: {},
  memberships: [],
  sessions: {},
  apiKeys: {},
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}$${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, keyHex] = storedHash.split('$');
    if (!salt || !keyHex) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(keyHex, 'hex');
    if (derivedKey.length !== keyBuffer.length) return false;
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

class AuthEngine {
  private state: AuthDatabaseState;

  constructor() {
    const loaded = statePersistence.loadSnapshot<AuthDatabaseState>('auth-tenant-store', INITIAL_AUTH_STATE);
    if (loaded.source !== 'fallback' && loaded.data && loaded.data.users) {
      this.state = loaded.data;
    } else {
      this.state = JSON.parse(JSON.stringify(INITIAL_AUTH_STATE));
      this.persist();
    }
  }

  public persist(): void {
    try {
      statePersistence.saveSnapshot('auth-tenant-store', this.state);
    } catch {
      // Non-fatal fallback
    }
  }

  public getState(): AuthDatabaseState {
    return this.state;
  }

  public authenticateSession(sessionId?: string): { user: UserAccount; session: UserSession; tenant: TenantWorkspace; role: UserRole } | null {
    if (!sessionId) return null;
    const session = this.state.sessions[sessionId];
    if (!session || session.expiresAt < Date.now()) {
      if (session) delete this.state.sessions[sessionId];
      return null;
    }
    const user = this.state.users[session.userId];
    const tenant = this.state.tenants[session.tenantId];
    if (!user || !tenant || tenant.status !== 'active') return null;

    const membership = this.state.memberships.find(
      (m) => m.userId === user.id && m.tenantId === tenant.tenantId
    );
    const role: UserRole = membership ? membership.role : 'viewer';

    return { user, session, tenant, role };
  }

  public verifyApiKey(authHeader?: string, apiKeyHeader?: string, tenantIdHeader?: string): { tenant: TenantWorkspace; scope: 'ingest:write' | 'telemetry:read' } | null {
    let rawKey = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.substring(7).trim();
    } else if (apiKeyHeader) {
      rawKey = apiKeyHeader.trim();
    }

    if (!rawKey) return null;

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const now = Date.now();

    for (const [tId, keys] of Object.entries(this.state.apiKeys)) {
      if (tenantIdHeader && tenantIdHeader !== tId) continue;
      for (const k of keys) {
        if (k.revokedAt) continue;
        const matchesActive = k.hash === keyHash && (!k.expiresAt || k.expiresAt > now);
        const matchesGrace = k.graceExpiresAt && k.graceExpiresAt > now && k.hash === keyHash;

        if (matchesActive || matchesGrace) {
          const tenant = this.state.tenants[tId];
          if (tenant && tenant.status === 'active') {
            return { tenant, scope: 'ingest:write' };
          }
        }
      }
    }
    return null;
  }

  public createUser(email: string, name: string, password: string): { user: UserAccount; tenant: TenantWorkspace } {
    const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const companyName = `${name}'s Organization`;

    const newUser: UserAccount = {
      id: userId,
      email: email.toLowerCase().trim(),
      name,
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };

    const newTenant: TenantWorkspace = {
      tenantId,
      name: companyName,
      slug: `${slug}-${tenantId.substring(tenantId.length - 4)}`,
      status: 'active',
      ingestionPaused: false,
      ingestionRateLimitRps: 2000,
      retentionTtlDays: 30,
      createdAt: Date.now(),
    };

    const membership: TenantMembership = {
      userId,
      tenantId,
      role: 'admin',
      joinedAt: Date.now(),
    };

    this.state.users[userId] = newUser;
    this.state.tenants[tenantId] = newTenant;
    this.state.memberships.push(membership);
    this.state.apiKeys[tenantId] = [
      {
        keyId: `key-${Date.now()}`,
        tenantId,
        name: 'Default Tenant API Key',
        prefix: `nc_live_${Math.random().toString(36).substring(2, 6)}`,
        hash: crypto.createHash('sha256').update(`nc_live_${crypto.randomBytes(16).toString('hex')}`).digest('hex'),
        scopes: ['ingest:write', 'telemetry:read'],
        createdAt: Date.now(),
      },
    ];

    this.persist();
    return { user: newUser, tenant: newTenant };
  }

  public createSession(userId: string, tenantId: string, ipAddress?: string, userAgent?: string): UserSession {
    const sessionId = `ses_${crypto.randomBytes(24).toString('hex')}`;
    const session: UserSession = {
      sessionId,
      userId,
      tenantId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 7, // 7 days
      ipAddress,
      userAgent,
    };
    this.state.sessions[sessionId] = session;
    this.state.users[userId].lastLoginAt = Date.now();
    this.persist();
    return session;
  }

  public destroySession(sessionId: string): void {
    if (this.state.sessions[sessionId]) {
      delete this.state.sessions[sessionId];
      this.persist();
    }
  }

  public checkLastAdminProtection(tenantId: string, targetUserId: string): boolean {
    const adminMembers = this.state.memberships.filter(
      (m) => m.tenantId === tenantId && m.role === 'admin'
    );
    if (adminMembers.length === 1 && adminMembers[0].userId === targetUserId) {
      return true; // Last admin lockout protection triggered
    }
    return false;
  }
}

export const authEngine = new AuthEngine();
