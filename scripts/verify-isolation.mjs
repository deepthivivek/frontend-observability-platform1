#!/usr/bin/env node
/**
 * Automated Multi-Tenant Security, RBAC, Isolation, TOTP MFA, Step-Up Auth,
 * PII/Secret Redaction, Encrypted Settings, Key-Rotation & Audit Integrity Suite.
 * Wired to: npm run test:security
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(base32) {
  const clean = base32.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function computeTotpForStep(base32Secret, step) {
  const key = decodeBase32(base32Secret);
  const counterBuf = Buffer.alloc(8);
  const hi = Math.floor(step / 0x100000000);
  const lo = step >>> 0;
  counterBuf.writeUInt32BE(hi, 0);
  counterBuf.writeUInt32BE(lo, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(codeInt % 1_000_000).padStart(6, '0');
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3199;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/healthz`, { cache: 'no-store' });
      if (res.ok) return;
    } catch {
      // Wait for boot
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error(`Timed out waiting for Next.js test server at ${baseUrl}`);
}

function extractSessionCookie(res) {
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const c of setCookie) {
    const match = c.match(/neon_chasm_session=([^;]+)/);
    if (match) return `neon_chasm_session=${match[1]}`;
  }
  const raw = res.headers.get('set-cookie') || '';
  const match = raw.match(/neon_chasm_session=([^;]+)/);
  return match ? `neon_chasm_session=${match[1]}` : '';
}

async function reqJson(baseUrl, endpoint, opts = {}) {
  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { rawText: text.slice(0, 200) };
  }
  return { res, body };
}

async function runSuite() {
  let baseUrl = process.env.TEST_BASE_URL || '';
  let childProc = null;
  let tempDataDir = null;

  try {
    if (!baseUrl) {
      const port = await findFreePort();
      baseUrl = `http://127.0.0.1:${port}`;
      tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neon-chasm-sec-'));
      const hasProdBuild = fs.existsSync(path.join(process.cwd(), '.next', 'BUILD_ID'));
      const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next');
      const nextArgs = hasProdBuild
        ? ['start', '-H', '127.0.0.1', '-p', String(port)]
        : ['dev', '-H', '127.0.0.1', '-p', String(port)];

      childProc = spawn(nextBin, nextArgs, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: hasProdBuild ? 'production' : 'development',
          PORT: String(port),
          DATA_DIR: tempDataDir,
          NEON_CHASM_STATE_DIR: tempDataDir,
          SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
          DISABLE_HMR: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      await waitForServer(baseUrl);
    }

    const logStep = (name) => {
      console.log(`PASS: ${name}`);
    };

    // 1. Security Headers & Zero-Mock Clean Boot Check
    {
      const homeRes = await fetch(`${baseUrl}/`, { redirect: 'manual' });
      assert.equal(homeRes.headers.get('x-powered-by'), null, 'X-Powered-By must be disabled');
      assert.equal(homeRes.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(homeRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.ok(homeRes.headers.get('permissions-policy')?.includes('camera=()'));
      assert.ok(homeRes.headers.get('strict-transport-security')?.includes('max-age=63072000'));
      const csp = homeRes.headers.get('content-security-policy') || '';
      assert.ok(csp.includes("frame-ancestors 'self' https://*.google.com https://*.googleusercontent.com"));
      assert.notEqual(homeRes.headers.get('x-frame-options')?.toUpperCase(), 'DENY');

      const { res: sessRes, body: sessBody } = await reqJson(baseUrl, '/api/v1/auth/session');
      assert.equal(sessRes.status, 200);
      assert.equal(sessBody.authenticated, false);
      assert.equal(sessBody.hasUsers, false);
      assert.equal(sessRes.headers.get('cache-control'), 'private, no-store, max-age=0');
      const vary = (sessRes.headers.get('vary') || '').toLowerCase();
      assert.ok(vary.includes('cookie') && vary.includes('authorization') && vary.includes('x-tenant-id'));

      const { res: healthRes, body: healthBody } = await reqJson(baseUrl, '/healthz');
      assert.equal(healthRes.status, 200);
      assert.equal(healthBody.status, 'healthy');

      const { res: apiHealthRes, body: apiHealthBody } = await reqJson(baseUrl, '/api/healthz');
      assert.equal(apiHealthRes.status, 200);
      assert.equal(apiHealthBody.status, 'healthy');

      const { res: readyRes, body: readyBody } = await reqJson(baseUrl, '/readyz');
      assert.equal(readyRes.status, 200);
      assert.equal(readyBody.status, 'READY');
      assert.equal(readyBody.platformTelemetry.totalBufferedRecords, 0);

      const { res: apiReadyRes, body: apiReadyBody } = await reqJson(baseUrl, '/api/readyz');
      assert.equal(apiReadyRes.status, 200);
      assert.equal(apiReadyBody.status, 'READY');
      logStep('Security headers, anti-cache Vary, probe endpoints (/healthz, /api/healthz, /readyz, /api/readyz), and 0-event clean boot');
    }

    // 2. Unauthenticated 401 & Spoofed Internal Header 403 Checks
    {
      for (const ep of ['/api/v1/telemetry/recent', '/api/v1/auth/audit', '/api/v1/settings', '/api/v1/stream/telemetry', '/api/v1/auth/mfa']) {
        const { res } = await reqJson(baseUrl, ep);
        assert.equal(res.status, 401, `Expected 401 on unauthenticated GET ${ep}`);
      }

      const { res: unauthPost } = await reqJson(baseUrl, '/api/v1/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spans: [{ name: 'probe' }] }),
      });
      assert.equal(unauthPost.status, 401);

      const { res: spoofedRes, body: spoofedBody } = await reqJson(baseUrl, '/api/v1/telemetry/recent', {
        headers: { 'x-middleware-subrequest': 'middleware:src/middleware' },
      });
      assert.equal(spoofedRes.status, 403);
      assert.equal(spoofedBody.code, 'FORBIDDEN_INTERNAL_HEADER');
      logStep('Unauthenticated 401 and spoofed x-middleware-subrequest 403 rejection');
    }

    // 3. Strong Password Policy + Multi-Company Registration + CSRF Check + Cross-Tenant 403 Isolation
    let cookieA = '';
    let tenantA = '';
    let adminAUserId = '';
    let cookieB = '';
    let tenantB = '';

    {
      // Short password rejected
      const shortPw = await reqJson(baseUrl, '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Weak User',
          email: 'weak@alpha.example.com',
          password: 'short123!',
          companyName: 'Weak Co',
        }),
      });
      assert.equal(shortPw.res.status, 400);

      // Common/predictable >= 12 char password rejected
      const commonPw = await reqJson(baseUrl, '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Weak User',
          email: 'weak@alpha.example.com',
          password: 'password1234',
          companyName: 'Weak Co',
        }),
      });
      assert.equal(commonPw.res.status, 400);
      assert.equal(commonPw.body.code, 'WEAK_PASSWORD');

      const regA = await reqJson(baseUrl, '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alice Alpha',
          email: 'alice@alpha.example.com',
          password: 'StrongPassword#2025',
          companyName: 'Alpha Corp',
        }),
      });
      assert.equal(regA.res.status, 201);
      cookieA = extractSessionCookie(regA.res);
      assert.ok(cookieA, 'Session cookie must be issued for Company A');
      tenantA = regA.body.tenant.tenantId;
      adminAUserId = regA.body.user.id;

      const regB = await reqJson(baseUrl, '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bob Beta',
          email: 'bob@beta.example.com',
          password: 'StrongPassword#2025',
          companyName: 'Beta Labs',
        }),
      });
      assert.equal(regB.res.status, 201);
      cookieB = extractSessionCookie(regB.res);
      tenantB = regB.body.tenant.tenantId;
      assert.notEqual(tenantA, tenantB);

      // CSRF origin rejection
      const csrfRes = await reqJson(baseUrl, '/api/v1/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieA,
          Origin: 'https://evil-attacker.example',
        },
        body: JSON.stringify({ latencyWarnMs: 150 }),
      });
      assert.equal(csrfRes.res.status, 403);
      assert.equal(csrfRes.body.code, 'CSRF_FORBIDDEN');

      // Cross-tenant header spoofing rejection
      const crossHeader = await reqJson(baseUrl, '/api/v1/telemetry/recent', {
        headers: {
          Cookie: cookieA,
          'X-Tenant-ID': tenantB,
        },
      });
      assert.equal(crossHeader.res.status, 403);
      assert.equal(crossHeader.body.code, 'TENANT_FORBIDDEN');

      // Company A ingests record with sensitive credentials; verify PII/secret redaction BEFORE storage & broadcast
      const leakedBearer = 'super_secret_bearer_token_987654';
      const leakedApiKey = 'nc_live_leaked_secret_0011223344';
      const ingestA = await reqJson(baseUrl, '/api/v1/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({
          source: 'alpha-service',
          spans: [
            {
              name: 'GET /alpha-secret',
              method: 'GET',
              endpoint: '/alpha-secret',
              statusCode: 200,
              durationMs: 18,
              service: 'alpha-service',
              requestHeaders: {
                authorization: `Bearer ${leakedBearer}`,
                'x-api-key': leakedApiKey,
              },
            },
          ],
          logs: [
            {
              level: 'WARN',
              service: 'alpha-auth',
              message: `Auth handshake failed for token=${leakedBearer}`,
              attributes: {
                password: 'ClientSuppliedSecretPassword!',
                cookie: 'session=secret_cookie_value',
              },
            },
          ],
        }),
      });
      assert.equal(ingestA.res.status, 202);
      assert.equal(ingestA.body.tenantId, tenantA);
      assert.ok(ingestA.body.redactedCount >= 4, 'Expected at least 4 sensitive fields/tokens redacted');

      const recentA = await reqJson(baseUrl, '/api/v1/telemetry/recent', {
        headers: { Cookie: cookieA },
      });
      assert.equal(recentA.res.status, 200);
      const rawStoredJson = JSON.stringify(recentA.body.records);
      assert.ok(!rawStoredJson.includes(leakedBearer), 'Raw Bearer token must never be persisted or returned');
      assert.ok(!rawStoredJson.includes(leakedApiKey), 'Raw API key must never be persisted or returned');
      assert.ok(!rawStoredJson.includes('ClientSuppliedSecretPassword!'), 'Raw password must never be persisted or returned');
      assert.ok(rawStoredJson.includes('[REDACTED]'), 'Redacted placeholder must replace sensitive fields');

      const recentB = await reqJson(baseUrl, '/api/v1/telemetry/recent', {
        headers: { Cookie: cookieB },
      });
      assert.equal(recentB.res.status, 200);
      assert.equal(recentB.body.totalBuffered, 0, 'Company B must not see Company A telemetry');
      logStep('Password policy (12+ chars), cross-tenant isolation, CSRF 403, and OTLP secret redaction');
    }

    // 4. Encrypted Outbound Webhook Setting & SSRF Guard
    {
      const ssrfAttempt = await reqJson(baseUrl, '/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ webhookUrl: 'http://127.0.0.1:8080/internal-hook' }),
      });
      assert.equal(ssrfAttempt.res.status, 400);
      assert.equal(ssrfAttempt.body.code, 'INVALID_WEBHOOK_URL');

      const rawHook = 'https://hooks.example.org/services/T000/B000/SecretTokenXYZ';
      const saveHook = await reqJson(baseUrl, '/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ webhookUrl: rawHook }),
      });
      assert.equal(saveHook.res.status, 200);
      assert.equal(saveHook.body.settings.hasWebhookUrl, true);
      assert.ok(!JSON.stringify(saveHook.body).includes('SecretTokenXYZ'), 'Plaintext webhook secret must not be echoed back');
      assert.ok(saveHook.body.settings.maskedWebhookUrl.includes('hooks.example.org'));

      const readSettings = await reqJson(baseUrl, '/api/v1/settings', {
        headers: { Cookie: cookieA },
      });
      assert.equal(readSettings.res.status, 200);
      assert.equal(readSettings.body.settings.hasWebhookUrl, true);
      assert.ok(!JSON.stringify(readSettings.body).includes('SecretTokenXYZ'));
      logStep('AES-256-GCM outbound webhook encryption and loopback/private IP SSRF rejection');
    }

    // 5. Viewer RBAC Read-Only Enforcement & 409 Last-Admin Lockout
    {
      const inviteRes = await reqJson(baseUrl, '/api/v1/auth/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({
          action: 'invite',
          email: 'viewer@alpha.example.com',
          role: 'viewer',
        }),
      });
      assert.equal(inviteRes.res.status, 201);
      const inviteToken = inviteRes.body.invite.inviteToken;
      assert.ok(inviteToken);

      const acceptRes = await reqJson(baseUrl, '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Victor Viewer',
          email: 'viewer@alpha.example.com',
          password: 'CobaltObservatory#2025',
          inviteToken,
        }),
      });
      assert.equal(acceptRes.res.status, 201);
      assert.equal(acceptRes.body.role, 'viewer');
      const cookieViewer = extractSessionCookie(acceptRes.res);

      const viewerRead = await reqJson(baseUrl, '/api/v1/telemetry/recent', {
        headers: { Cookie: cookieViewer },
      });
      assert.equal(viewerRead.res.status, 200);
      assert.equal(viewerRead.body.totalBuffered, 2);

      const viewerIngest = await reqJson(baseUrl, '/api/v1/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieViewer },
        body: JSON.stringify({ spans: [{ name: 'blocked' }] }),
      });
      assert.equal(viewerIngest.res.status, 403);

      const viewerSettings = await reqJson(baseUrl, '/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieViewer },
        body: JSON.stringify({ latencyWarnMs: 999 }),
      });
      assert.equal(viewerSettings.res.status, 403);

      // Promote/demote sole admin hits step-up first OR 409 last-admin lockout once stepped up
      const stepUpA = await reqJson(baseUrl, '/api/v1/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ password: 'StrongPassword#2025' }),
      });
      assert.equal(stepUpA.res.status, 200);
      assert.equal(stepUpA.body.stepUpActive, true);

      const demoteRes = await reqJson(baseUrl, '/api/v1/auth/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({
          action: 'update_role',
          userId: adminAUserId,
          role: 'editor',
        }),
      });
      assert.equal(demoteRes.res.status, 409);
      assert.equal(demoteRes.body.code, 'LAST_ADMIN_LOCKOUT');
      logStep('Viewer read-only RBAC (403) and Last-Admin Lockout (409)');
    }

    // 6. Server-Enforced Step-Up Auth + Zero-Downtime API Key Rotation + 503 Ingestion Kill-Switch
    {
      // Fresh login for Alice (without stepUpActive)
      const freshLogin = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice@alpha.example.com',
          password: 'StrongPassword#2025',
        }),
      });
      assert.equal(freshLogin.res.status, 200);
      cookieA = extractSessionCookie(freshLogin.res);
      assert.equal(freshLogin.body.stepUpActive, false);

      const keyCreate = await reqJson(baseUrl, '/api/v1/auth/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({
          action: 'create',
          name: 'OTel Collector Primary',
          scopes: ['ingest:write', 'telemetry:read'],
        }),
      });
      assert.equal(keyCreate.res.status, 201);
      const oldKeyId = keyCreate.body.key.keyId;
      const oldSecret = keyCreate.body.plainSecret;
      assert.ok(oldSecret.startsWith('nc_live_'));

      // Rotate key WITHOUT step-up -> must reject with 403 STEP_UP_REQUIRED
      const blockedRotate = await reqJson(baseUrl, '/api/v1/auth/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ action: 'rotate', keyId: oldKeyId, graceMinutes: 60 }),
      });
      assert.equal(blockedRotate.res.status, 403);
      assert.equal(blockedRotate.body.code, 'STEP_UP_REQUIRED');

      // Purge telemetry WITHOUT step-up -> must reject with 403 STEP_UP_REQUIRED
      const blockedPurge = await reqJson(baseUrl, '/api/v1/telemetry/recent', {
        method: 'DELETE',
        headers: { Cookie: cookieA },
      });
      assert.equal(blockedPurge.res.status, 403);
      assert.equal(blockedPurge.body.code, 'STEP_UP_REQUIRED');

      // Satisfy step-up challenge
      const unlockRes = await reqJson(baseUrl, '/api/v1/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ password: 'StrongPassword#2025' }),
      });
      assert.equal(unlockRes.res.status, 200);
      assert.equal(unlockRes.body.stepUpActive, true);

      // Rotate key WITH step-up -> succeeds
      const rotated = await reqJson(baseUrl, '/api/v1/auth/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ action: 'rotate', keyId: oldKeyId, graceMinutes: 60 }),
      });
      assert.equal(rotated.res.status, 200);
      const newSecret = rotated.body.plainSecret;
      assert.notEqual(oldSecret, newSecret);

      // Both grace key & new key must succeed
      for (const secret of [oldSecret, newSecret]) {
        const keyIngest = await reqJson(baseUrl, '/api/v1/telemetry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({
            source: 'otel-collector',
            spans: [{ name: 'POST /key-rotation-check', statusCode: 200, durationMs: 11 }],
          }),
        });
        assert.equal(keyIngest.res.status, 202);
      }

      // Pause ingestion -> 503 + Retry-After
      const pauseRes = await reqJson(baseUrl, '/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ ingestionPaused: true }),
      });
      assert.equal(pauseRes.res.status, 200);

      const pausedIngest = await reqJson(baseUrl, '/api/v1/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newSecret}`,
        },
        body: JSON.stringify({ spans: [{ name: 'paused-drop' }] }),
      });
      assert.equal(pausedIngest.res.status, 503);
      assert.ok(pausedIngest.res.headers.get('retry-after'), '503 must include Retry-After header');

      // Revoke old key -> 401
      const revokeRes = await reqJson(baseUrl, '/api/v1/auth/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ action: 'revoke', keyId: oldKeyId }),
      });
      assert.equal(revokeRes.res.status, 200);

      const revokedAttempt = await reqJson(baseUrl, '/api/v1/telemetry/recent', {
        headers: { Authorization: `Bearer ${oldSecret}` },
      });
      assert.equal(revokedAttempt.res.status, 401);
      logStep('Server step-up enforcement (403 STEP_UP_REQUIRED), key rotation, 503 kill-switch & revocation');
    }

    // 7. RFC 6238 TOTP MFA Enrollment, ±1 Clock Skew, Replay Block & Single-Use Recovery Codes
    {
      const setupRes = await reqJson(baseUrl, '/api/v1/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ action: 'setup' }),
      });
      assert.equal(setupRes.res.status, 200);
      const totpSecret = setupRes.body.secret;
      assert.ok(totpSecret && totpSecret.length >= 16);
      assert.ok(setupRes.body.otpauthUri.startsWith('otpauth://totp/'));

      const baseStep = Math.floor(Date.now() / 1000 / 30);
      const prevStepCode = computeTotpForStep(totpSecret, baseStep - 1);
      const currentStepCode = computeTotpForStep(totpSecret, baseStep);

      // Confirm using -1 skew step (verifies clock skew support)
      const confirmRes = await reqJson(baseUrl, '/api/v1/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ action: 'confirm', code: prevStepCode }),
      });
      assert.equal(confirmRes.res.status, 200);
      assert.equal(confirmRes.body.totpEnabled, true);
      assert.equal(confirmRes.body.recoveryCodes.length, 8);
      const recoveryCodes = confirmRes.body.recoveryCodes;

      // Login step 1 without TOTP code returns mfaRequired: true
      const mfaChallenge = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice@alpha.example.com',
          password: 'StrongPassword#2025',
        }),
      });
      assert.equal(mfaChallenge.res.status, 200);
      assert.equal(mfaChallenge.body.authenticated, false);
      assert.equal(mfaChallenge.body.mfaRequired, true);

      // Replaying previously used step fails with 401 TOTP_REPLAYED
      const replayAttempt = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice@alpha.example.com',
          password: 'StrongPassword#2025',
          totpCode: prevStepCode,
        }),
      });
      assert.equal(replayAttempt.res.status, 401);
      assert.equal(replayAttempt.body.code, 'TOTP_REPLAYED');

      // Login with current fresh step succeeds
      const mfaSuccess = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice@alpha.example.com',
          password: 'StrongPassword#2025',
          totpCode: currentStepCode,
        }),
      });
      assert.equal(mfaSuccess.res.status, 200);
      assert.equal(mfaSuccess.body.authenticated, true);
      assert.equal(mfaSuccess.body.user.totpEnabled, true);
      const cookieA2 = extractSessionCookie(mfaSuccess.res);

      // Login using single-use recovery code succeeds and burns that code
      const recLogin = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice@alpha.example.com',
          password: 'StrongPassword#2025',
          recoveryCode: recoveryCodes[0],
        }),
      });
      assert.equal(recLogin.res.status, 200);
      assert.equal(recLogin.body.authenticated, true);
      assert.equal(recLogin.body.user.recoveryCodesRemaining, 7);

      // Reusing burned recovery code is rejected
      const recReuse = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice@alpha.example.com',
          password: 'StrongPassword#2025',
          recoveryCode: recoveryCodes[0],
        }),
      });
      assert.equal(recReuse.res.status, 401);
      assert.equal(recReuse.body.code, 'INVALID_MFA');

      // Disabling MFA requires step-up, then succeeds once step-up is verified
      const disableBlocked = await reqJson(baseUrl, '/api/v1/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA2 },
        body: JSON.stringify({ action: 'disable' }),
      });
      assert.equal(disableBlocked.res.status, 403);
      assert.equal(disableBlocked.body.code, 'STEP_UP_REQUIRED');

      const stepUpViaRecovery = await reqJson(baseUrl, '/api/v1/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA2 },
        body: JSON.stringify({ recoveryCode: recoveryCodes[1] }),
      });
      assert.equal(stepUpViaRecovery.res.status, 200);

      const disableAllowed = await reqJson(baseUrl, '/api/v1/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA2 },
        body: JSON.stringify({ action: 'disable' }),
      });
      assert.equal(disableAllowed.res.status, 200);
      assert.equal(disableAllowed.body.totpEnabled, false);
      cookieA = cookieA2;
      logStep('RFC 6238 TOTP MFA enrollment, ±1 skew, replay blocking & single-use recovery codes');
    }

    // 8. Password Change Revokes Other Sessions & Workspace Deactivation
    {
      const changePw = await reqJson(baseUrl, '/api/v1/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({
          action: 'change_password',
          currentPassword: 'StrongPassword#2025',
          newPassword: 'EvenStronger#Password2026!',
        }),
      });
      assert.equal(changePw.res.status, 200);
      assert.equal(changePw.body.sessions.length, 1, 'Other sessions must be revoked upon password rotation');

      // Create secondary workspace & test step-up protected deactivation
      const createWs = await reqJson(baseUrl, '/api/v1/auth/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieA },
        body: JSON.stringify({ companyName: 'Temp Sandbox Org', switchImmediately: false }),
      });
      assert.equal(createWs.res.status, 201);
      const sandboxTenantId = createWs.body.tenant.tenantId;

      // Fresh login (no step-up) into tempCookie so DELETE workspace tests STEP_UP_REQUIRED
      const freshAdmin = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice@alpha.example.com',
          password: 'EvenStronger#Password2026!',
        }),
      });
      assert.equal(freshAdmin.res.status, 200);
      const tempCookie = extractSessionCookie(freshAdmin.res);
      const switchToSandbox = await reqJson(baseUrl, '/api/v1/auth/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: tempCookie },
        body: JSON.stringify({ tenantId: sandboxTenantId }),
      });
      assert.equal(switchToSandbox.res.status, 200);

      const delBlocked = await reqJson(baseUrl, '/api/v1/auth/workspaces', {
        method: 'DELETE',
        headers: { Cookie: tempCookie },
      });
      assert.equal(delBlocked.res.status, 403);
      assert.equal(delBlocked.body.code, 'STEP_UP_REQUIRED');

      const stepUpDel = await reqJson(baseUrl, '/api/v1/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: tempCookie },
        body: JSON.stringify({ password: 'EvenStronger#Password2026!' }),
      });
      assert.equal(stepUpDel.res.status, 200);

      const delAllowed = await reqJson(baseUrl, '/api/v1/auth/workspaces', {
        method: 'DELETE',
        headers: { Cookie: tempCookie },
      });
      assert.equal(delAllowed.res.status, 200);
      assert.equal(delAllowed.body.deactivatedTenantId, sandboxTenantId);

      // Session bound to deactivated workspace must immediately return 401
      const postDeactivateCheck = await reqJson(baseUrl, '/api/v1/telemetry/recent', {
        headers: { Cookie: tempCookie },
      });
      assert.equal(postDeactivateCheck.res.status, 401);
      logStep('Password rotation session revocation and step-up protected workspace deactivation');
    }

    // 9. Audit Log SHA-256 Hash-Chain Integrity & /readyz Self-Telemetry (Including Redaction Counter)
    {
      const auditRes = await reqJson(baseUrl, '/api/v1/auth/audit', {
        headers: { Cookie: cookieA },
      });
      assert.equal(auditRes.res.status, 200);
      assert.equal(auditRes.body.chainValid, true, 'SHA-256 audit hash chain must verify cleanly');
      assert.ok(auditRes.body.logs.length >= 6);

      const { res: readyRes, body: readyBody } = await reqJson(baseUrl, '/readyz');
      assert.equal(readyRes.status, 200);
      assert.ok(readyBody.platformTelemetry.totalIngestedRecords >= 4);
      assert.ok(readyBody.platformTelemetry.authChecksDenied >= 1);
      assert.ok(readyBody.platformTelemetry.redactedSecretsTotal >= 4);
      logStep('SHA-256 audit hash-chain integrity and /readyz redaction/auth telemetry');
    }

    // 10. Login Rate-Limit Backoff (429 + Retry-After)
    {
      const targetEmail = 'bob@beta.example.com';
      for (let i = 0; i < 5; i += 1) {
        const attempt = await reqJson(baseUrl, '/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail, password: 'WrongPassword123!' }),
        });
        assert.equal(attempt.res.status, 401);
      }
      const locked = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: 'WrongPassword123!' }),
      });
      assert.equal(locked.res.status, 429);
      assert.equal(locked.body.code, 'RATE_LIMITED');
      assert.ok(locked.res.headers.get('retry-after'));
      logStep('Login brute-force rate limit backoff (HTTP 429 + Retry-After)');
    }

    console.log('\nAll multi-tenant security, MFA, step-up & isolation checks passed.');
  } finally {
    if (childProc) {
      childProc.kill('SIGTERM');
    }
    if (tempDataDir) {
      fs.rmSync(tempDataDir, { recursive: true, force: true });
    }
  }
}

runSuite().catch((err) => {
  console.error('Security verification failed:', err);
  process.exit(1);
});
