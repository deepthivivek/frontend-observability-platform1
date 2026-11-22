import 'server-only';
import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const WEAK_PASSWORDS = new Set([
  'password1234',
  'password12345',
  'password123456',
  '123456789012',
  '1234567890123',
  '1234567890123456',
  'qwerty123456',
  'qwertyuiop12',
  'admin1234567',
  'administrator1',
  'administrator123',
  'welcome12345',
  'letmein12345',
  'changeme1234',
  'neonchasm123',
  'neonchasm1234',
  'company12345',
  'testpassword',
  'passw0rd1234',
  'supersecret1',
  '000000000000',
  '111111111111',
  'aaaaaaaaaaaa',
]);

export function validatePasswordStrength(
  password: string,
  context?: { email?: string; name?: string }
): { valid: boolean; reason?: string } {
  if (typeof password !== 'string') {
    return { valid: false, reason: 'Password is required.' };
  }
  if (password.length < 12) {
    return { valid: false, reason: 'Password must be at least 12 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, reason: 'Password must not exceed 128 characters.' };
  }

  const lower = password.toLowerCase();
  const compact = lower.replace(/[\s_-]+/g, '');
  if (WEAK_PASSWORDS.has(lower) || WEAK_PASSWORDS.has(compact)) {
    return { valid: false, reason: 'This password is too common. Choose a stronger, unique passphrase.' };
  }

  if (/^(.)\1+$/.test(lower) || /(.)\1{7,}/.test(lower)) {
    return { valid: false, reason: 'Password cannot consist of excessive repeated characters.' };
  }

  const sequences = ['01234567890123456789', '98765432109876543210', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm'];
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 8; i++) {
      if (lower.includes(seq.slice(i, i + 8))) {
        return { valid: false, reason: 'Password contains a predictable keyboard or numeric sequence.' };
      }
    }
  }

  if (context?.email) {
    const emailLower = context.email.toLowerCase().trim();
    const localPart = emailLower.split('@')[0] || '';
    if (localPart.length >= 4 && lower.includes(localPart)) {
      return { valid: false, reason: 'Password must not contain your email address or username.' };
    }
  }

  if (context?.name) {
    const nameTokens = context.name
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 4);
    for (const token of nameTokens) {
      if (lower.includes(token)) {
        return { valid: false, reason: 'Password must not contain your display name.' };
      }
    }
  }

  let classes = 0;
  if (/[a-z]/.test(password)) classes += 1;
  if (/[A-Z]/.test(password)) classes += 1;
  if (/[0-9]/.test(password)) classes += 1;
  if (/[^a-zA-Z0-9]/.test(password)) classes += 1;

  const uniqueChars = new Set(password).size;
  if (uniqueChars < 5 || (classes < 2 && password.length < 16)) {
    return {
      valid: false,
      reason: 'Use at least 12 characters with a mix of letters, numbers, or symbols (or a 16+ char multi-word passphrase).',
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// AES-256-GCM Encryption At Rest (HKDF Key Derivation from SESSION_SECRET)
// ---------------------------------------------------------------------------

export function deriveAes256Key(signingSecret: string): Buffer {
  const raw = crypto.hkdfSync(
    'sha256',
    Buffer.from(signingSecret, 'utf8'),
    Buffer.from('neon-chasm-aes-gcm-v1', 'utf8'),
    Buffer.from('sensitive-field-encryption', 'utf8'),
    32
  );
  return Buffer.from(raw);
}

export function encryptSensitiveValue(plaintext: string, signingSecret: string): string {
  const key = deriveAes256Key(signingSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSensitiveValue(envelope: string, signingSecret: string): string | null {
  try {
    const parts = envelope.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') return null;
    const [, ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    if (iv.length !== 12 || tag.length !== 16) return null;

    const key = deriveAes256Key(signingSecret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function maskSecretUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const tail = rawUrl.length > 10 ? rawUrl.slice(-4) : '****';
    return `${parsed.protocol}//${parsed.host}/***${tail}`;
  } catch {
    return 'https://***[ENCRYPTED]';
  }
}

export function validateOutboundWebhookUrl(rawUrl: string): { valid: boolean; reason?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: true };
  if (trimmed.length > 512) {
    return { valid: false, reason: 'Webhook URL exceeds maximum length (512 characters).' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Webhook URL must be a valid HTTP or HTTPS URL.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Webhook URL protocol must be https:// or http://.' };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Webhook URL must not embed credentials.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.startsWith('10.') ||
    host.startsWith('127.') ||
    host.startsWith('169.254.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe80:')
  ) {
    return { valid: false, reason: 'Webhook target cannot point to loopback or private network addresses.' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// RFC 6238 TOTP MFA (HMAC-SHA1 via native Node crypto) & Recovery Codes
// ---------------------------------------------------------------------------

function encodeBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
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

export function generateTotpSecret(): string {
  return encodeBase32(crypto.randomBytes(20));
}

export function buildTotpOtpAuthUri(params: {
  issuer: string;
  accountEmail: string;
  secret: string;
}): string {
  const issuerEnc = encodeURIComponent(params.issuer);
  const label = `${issuerEnc}:${encodeURIComponent(params.accountEmail)}`;
  return `otpauth://totp/${label}?secret=${encodeURIComponent(params.secret)}&issuer=${issuerEnc}&algorithm=SHA1&digits=6&period=30`;
}

export function computeTotpForStep(base32Secret: string, step: number): string {
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

export function verifyTotpCodeWithWindow(
  base32Secret: string,
  candidateCode: string,
  lastStepUsed?: number,
  nowMs: number = Date.now(),
  skewSteps: number = 1
): { valid: boolean; matchedStep?: number; replayed?: boolean } {
  const cleanCode = candidateCode.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) {
    return { valid: false };
  }
  const candBuf = Buffer.from(cleanCode, 'utf8');
  const currentStep = Math.floor(nowMs / 1000 / 30);

  for (let delta = -skewSteps; delta <= skewSteps; delta++) {
    const step = currentStep + delta;
    if (step < 0) continue;
    const expected = computeTotpForStep(base32Secret, step);
    const expBuf = Buffer.from(expected, 'utf8');
    if (expBuf.length === candBuf.length && crypto.timingSafeEqual(expBuf, candBuf)) {
      if (typeof lastStepUsed === 'number' && step <= lastStepUsed) {
        return { valid: false, replayed: true };
      }
      return { valid: true, matchedStep: step };
    }
  }

  return { valid: false };
}

function hashRecoveryCode(normalizedCode: string): string {
  return crypto.createHash('sha256').update(`nc-recovery-v1:${normalizedCode}`, 'utf8').digest('hex');
}

export function generateRecoveryCodes(count = 8): { plainCodes: string[]; hashedCodes: string[] } {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(10);
    let raw = '';
    for (let j = 0; j < 10; j++) {
      raw += RECOVERY_ALPHABET[bytes[j] % RECOVERY_ALPHABET.length];
    }
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
    plainCodes.push(formatted);
    hashedCodes.push(hashRecoveryCode(raw));
  }
  return { plainCodes, hashedCodes };
}

export function verifyAndConsumeRecoveryCode(
  candidate: string,
  hashedCodes: string[]
): { matched: boolean; remainingHashes: string[] } {
  const normalized = candidate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < 8) {
    return { matched: false, remainingHashes: hashedCodes };
  }
  const candidateHash = Buffer.from(hashRecoveryCode(normalized), 'utf8');
  let matchedIndex = -1;
  for (let i = 0; i < hashedCodes.length; i++) {
    const stored = Buffer.from(hashedCodes[i], 'utf8');
    if (stored.length === candidateHash.length && crypto.timingSafeEqual(stored, candidateHash)) {
      matchedIndex = i;
    }
  }
  if (matchedIndex === -1) {
    return { matched: false, remainingHashes: hashedCodes };
  }
  const remainingHashes = hashedCodes.filter((_, idx) => idx !== matchedIndex);
  return { matched: true, remainingHashes };
}

// ---------------------------------------------------------------------------
// Recursive Bounded PII & Secret Redaction for Telemetry Ingestion
// ---------------------------------------------------------------------------

const SENSITIVE_KEY_PATTERNS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'password',
  'passwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'x-api-key',
  'x-auth-token',
  'private_key',
  'client_secret',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase().trim();
  if (!lower) return false;
  return SENSITIVE_KEY_PATTERNS.some((pat) => lower === pat || lower.includes(pat));
}

function scrubInlineSecrets(input: string): { value: string; count: number } {
  let count = 0;
  let out = input;

  out = out.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, (_m, prefix: string) => {
    count += 1;
    return `${prefix}[REDACTED]`;
  });

  out = out.replace(/\b(nc_live_|nci_)[A-Za-z0-9_-]{8,}\b/g, () => {
    count += 1;
    return '[REDACTED]';
  });

  out = out.replace(
    /((?:authorization|cookie|set-cookie|x-api-key|api_key|password|secret|token)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    (_m, prefix: string) => {
      count += 1;
      return `${prefix}[REDACTED]`;
    }
  );

  return { value: out, count };
}

export function redactSensitivePayload<T>(
  input: T,
  maxDepth = 10
): { sanitized: T; redactedCount: number } {
  let redactedCount = 0;
  const seen = new WeakSet<object>();

  function walk(node: unknown, depth: number): unknown {
    if (depth > maxDepth) {
      return '[MAX_DEPTH_TRUNCATED]';
    }
    if (node === null || node === undefined) {
      return node;
    }
    if (typeof node === 'string') {
      const scrubbed = scrubInlineSecrets(node);
      redactedCount += scrubbed.count;
      return scrubbed.value;
    }
    if (typeof node !== 'object') {
      return node;
    }

    if (seen.has(node)) {
      return '[CIRCULAR_TRUNCATED]';
    }
    seen.add(node);

    if (Array.isArray(node)) {
      return node.map((item) => walk(item, depth + 1));
    }

    const source = node as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      const val = source[key];
      if (isSensitiveKey(key)) {
        if (val !== undefined && val !== null && val !== '[REDACTED]') {
          redactedCount += 1;
          clean[key] = '[REDACTED]';
        } else {
          clean[key] = val === '[REDACTED]' ? '[REDACTED]' : val;
        }
      } else {
        clean[key] = walk(val, depth + 1);
      }
    }
    return clean;
  }

  const sanitized = walk(input, 0) as T;
  return { sanitized, redactedCount };
}
