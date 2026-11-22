/**
 * Authentication, Workspace Tenant Management & API Key Rotation Router
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authEngine, verifyPassword, hashPassword, UserRole } from '../security/authEngine';

export const authAndTenantRouter = Router();

// Helper to parse cookie from header
function parseCookie(cookieHeader?: string, name = 'neon_chasm_session'): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

// 1. Get Session Profile
authAndTenantRouter.get('/auth/session', (req: Request, res: Response) => {
  const cookieHeader = req.headers.cookie;
  const sessionId = parseCookie(cookieHeader);
  const auth = authEngine.authenticateSession(sessionId);

  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated session', code: 'UNAUTHENTICATED' });
  }

  const state = authEngine.getState();
  const userMemberships = state.memberships
    .filter((m) => m.userId === auth.user.id)
    .map((m) => {
      const t = state.tenants[m.tenantId];
      return {
        tenantId: m.tenantId,
        name: t ? t.name : 'Unknown Workspace',
        slug: t ? t.slug : '',
        role: m.role,
        ingestionPaused: t ? t.ingestionPaused : false,
      };
    });

  res.json({
    user: { id: auth.user.id, email: auth.user.email, name: auth.user.name },
    activeTenant: {
      tenantId: auth.tenant.tenantId,
      name: auth.tenant.name,
      slug: auth.tenant.slug,
      role: auth.role,
      ingestionPaused: auth.tenant.ingestionPaused,
      retentionTtlDays: auth.tenant.retentionTtlDays,
    },
    memberships: userMemberships,
    requestId: req.requestId,
    timestamp: Date.now(),
  });
});

// 2. Register User & Default Workspace
authAndTenantRouter.post('/auth/register', (req: Request, res: Response) => {
  const { email, name, password } = req.body || {};
  if (!email || !name || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid registration parameters.', code: 'INVALID_REQUEST' });
  }

  const state = authEngine.getState();
  const existing = Object.values(state.users).find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
  }

  const { user, tenant } = authEngine.createUser(email, name, password);
  const session = authEngine.createSession(user.id, tenant.tenantId, req.ip, req.headers['user-agent']);

  res.setHeader(
    'Set-Cookie',
    `neon_chasm_session=${encodeURIComponent(session.sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );

  res.status(201).json({
    message: 'User registered and workspace created successfully.',
    user: { id: user.id, email: user.email, name: user.name },
    activeTenant: { tenantId: tenant.tenantId, name: tenant.name, role: 'admin' },
    requestId: req.requestId,
  });
});

// 3. Login
authAndTenantRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid login credentials format.', code: 'INVALID_REQUEST' });
  }

  const state = authEngine.getState();
  const user = Object.values(state.users).find((u) => u.email.toLowerCase() === email.toLowerCase().trim());

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
  }

  // Find user's default/first tenant membership
  const membership = state.memberships.find((m) => m.userId === user.id);
  const tenantId = membership ? membership.tenantId : 'default-tenant';
  const session = authEngine.createSession(user.id, tenantId, req.ip, req.headers['user-agent']);

  res.setHeader(
    'Set-Cookie',
    `neon_chasm_session=${encodeURIComponent(session.sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );

  res.json({
    message: 'Authentication successful.',
    user: { id: user.id, email: user.email, name: user.name },
    activeTenantId: tenantId,
    requestId: req.requestId,
  });
});

// 4. Logout
authAndTenantRouter.post('/auth/logout', (req: Request, res: Response) => {
  const cookieHeader = req.headers.cookie;
  const sessionId = parseCookie(cookieHeader);
  if (sessionId) {
    authEngine.destroySession(sessionId);
  }

  res.setHeader(
    'Set-Cookie',
    `neon_chasm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );

  res.json({ message: 'Session terminated successfully.', requestId: req.requestId });
});

// 5. List User Workspaces
authAndTenantRouter.get('/workspaces', (req: Request, res: Response) => {
  const auth = authEngine.authenticateSession(parseCookie(req.headers.cookie));
  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated session', code: 'UNAUTHENTICATED' });
  }

  const state = authEngine.getState();
  const workspaces = state.memberships
    .filter((m) => m.userId === auth.user.id)
    .map((m) => {
      const t = state.tenants[m.tenantId];
      return t ? { tenantId: t.tenantId, name: t.name, slug: t.slug, role: m.role, ingestionPaused: t.ingestionPaused } : null;
    })
    .filter(Boolean);

  res.json({ workspaces, requestId: req.requestId });
});

// 6. Create Workspace
authAndTenantRouter.post('/workspaces', (req: Request, res: Response) => {
  const auth = authEngine.authenticateSession(parseCookie(req.headers.cookie));
  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated session', code: 'UNAUTHENTICATED' });
  }

  const { name } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Valid company workspace name is required.', code: 'INVALID_NAME' });
  }

  const state = authEngine.getState();
  const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

  state.tenants[tenantId] = {
    tenantId,
    name: name.trim(),
    slug: `${slug}-${tenantId.substring(tenantId.length - 4)}`,
    status: 'active',
    ingestionPaused: false,
    ingestionRateLimitRps: 2000,
    retentionTtlDays: 30,
    createdAt: Date.now(),
  };

  state.memberships.push({
    userId: auth.user.id,
    tenantId,
    role: 'admin',
    joinedAt: Date.now(),
  });

  state.apiKeys[tenantId] = [
    {
      keyId: `key-${Date.now()}`,
      tenantId,
      name: 'Primary API Key',
      prefix: `nc_live_${Math.random().toString(36).substring(2, 6)}`,
      hash: crypto.createHash('sha256').update(`nc_live_${crypto.randomBytes(16).toString('hex')}`).digest('hex'),
      scopes: ['ingest:write', 'telemetry:read'],
      createdAt: Date.now(),
    },
  ];

  authEngine.persist();

  res.status(201).json({ message: 'Company workspace created.', tenantId, requestId: req.requestId });
});

// 7. Switch Active Workspace
authAndTenantRouter.post('/workspaces/switch', (req: Request, res: Response) => {
  const cookieHeader = req.headers.cookie;
  const sessionId = parseCookie(cookieHeader);
  const auth = authEngine.authenticateSession(sessionId);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated session', code: 'UNAUTHENTICATED' });
  }

  const { tenantId } = req.body || {};
  const state = authEngine.getState();
  const membership = state.memberships.find((m) => m.userId === auth.user.id && m.tenantId === tenantId);

  if (!membership || !state.tenants[tenantId]) {
    return res.status(403).json({ error: 'Unauthorized workspace switch or workspace not found.', code: 'FORBIDDEN_WORKSPACE' });
  }

  // Update session active tenant
  auth.session.tenantId = tenantId;
  authEngine.persist();

  res.json({ message: 'Active workspace switched successfully.', tenantId, requestId: req.requestId });
});

// 8. List & Create API Keys
authAndTenantRouter.get('/apikeys', (req: Request, res: Response) => {
  const auth = authEngine.authenticateSession(parseCookie(req.headers.cookie));
  if (!auth) {
    return res.status(401).json({ error: 'Unauthenticated session', code: 'UNAUTHENTICATED' });
  }

  const state = authEngine.getState();
  const keys = (state.apiKeys[auth.tenant.tenantId] || []).map((k) => ({
    keyId: k.keyId,
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes,
    createdAt: k.createdAt,
    expiresAt: k.expiresAt,
    revokedAt: k.revokedAt,
  }));

  res.json({ keys, requestId: req.requestId });
});

authAndTenantRouter.post('/apikeys', (req: Request, res: Response) => {
  const auth = authEngine.authenticateSession(parseCookie(req.headers.cookie));
  if (!auth || auth.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required to manage API keys.', code: 'FORBIDDEN_ADMIN' });
  }

  const { name, scopes } = req.body || {};
  const apiKeyName = typeof name === 'string' && name.trim() ? name.trim() : 'Custom Ingestion Key';
  const keyScopes = Array.isArray(scopes) ? scopes : ['ingest:write', 'telemetry:read'];

  const rawSecret = `nc_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
  const prefix = rawSecret.substring(0, 12);

  const keyId = `key-${Date.now()}`;
  const newKey = {
    keyId,
    tenantId: auth.tenant.tenantId,
    name: apiKeyName,
    prefix,
    hash: keyHash,
    scopes: keyScopes,
    createdAt: Date.now(),
  };

  const state = authEngine.getState();
  if (!state.apiKeys[auth.tenant.tenantId]) {
    state.apiKeys[auth.tenant.tenantId] = [];
  }
  state.apiKeys[auth.tenant.tenantId].push(newKey);
  authEngine.persist();

  // Return full secret ONLY ONCE upon creation
  res.status(201).json({
    message: 'API Key generated successfully. Save this secret now; it will never be shown again.',
    keyId,
    secret: rawSecret,
    prefix,
    requestId: req.requestId,
  });
});

// 9. Zero-Downtime Key Rotation
authAndTenantRouter.post('/apikeys/:keyId/rotate', (req: Request, res: Response) => {
  const auth = authEngine.authenticateSession(parseCookie(req.headers.cookie));
  if (!auth || auth.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required.', code: 'FORBIDDEN_ADMIN' });
  }

  const { keyId } = req.params;
  const state = authEngine.getState();
  const keys = state.apiKeys[auth.tenant.tenantId] || [];
  const targetKey = keys.find((k) => k.keyId === keyId);

  if (!targetKey) {
    return res.status(404).json({ error: 'API Key not found.', code: 'NOT_FOUND' });
  }

  const rawSecret = `nc_live_${crypto.randomBytes(24).toString('hex')}`;
  const newHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
  const newPrefix = rawSecret.substring(0, 12);
  const now = Date.now();

  // Zero-downtime rotation: retain old key in grace period for 1 hour
  targetKey.graceExpiresAt = now + 3600000;
  
  const rotatedKey = {
    keyId: `key-${Date.now()}`,
    tenantId: auth.tenant.tenantId,
    name: `${targetKey.name} (Rotated)`,
    prefix: newPrefix,
    hash: newHash,
    scopes: targetKey.scopes,
    createdAt: now,
  };

  keys.push(rotatedKey);
  authEngine.persist();

  res.json({
    message: 'API Key zero-downtime rotation initiated. Previous key valid during 1-hour grace window.',
    newKeyId: rotatedKey.keyId,
    secret: rawSecret,
    prefix: newPrefix,
    graceExpiresAt: targetKey.graceExpiresAt,
    requestId: req.requestId,
  });
});

// 10. Revoke API Key
authAndTenantRouter.delete('/apikeys/:keyId', (req: Request, res: Response) => {
  const auth = authEngine.authenticateSession(parseCookie(req.headers.cookie));
  if (!auth || auth.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required.', code: 'FORBIDDEN_ADMIN' });
  }

  const { keyId } = req.params;
  const state = authEngine.getState();
  const keys = state.apiKeys[auth.tenant.tenantId] || [];
  const targetKey = keys.find((k) => k.keyId === keyId);

  if (!targetKey) {
    return res.status(404).json({ error: 'API Key not found.', code: 'NOT_FOUND' });
  }

  targetKey.revokedAt = Date.now();
  authEngine.persist();

  res.json({ message: 'API Key revoked successfully.', requestId: req.requestId });
});
