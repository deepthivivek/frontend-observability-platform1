/**
 * Telemetry PII & Confidentiality Redactor (Day 13)
 * Sanitizes all telemetry logs, database queries, and trace attributes
 * prior to LLM synthesis or persistent audit storage.
 */

// Common sensitive patterns
const JWT_REGEX = /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g;
const CREDIT_CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{13,19}\b/g;
const API_KEY_REGEX = /\b(sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36})\b/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PASSWORD_KV_REGEX = /(user_pass|pass|password|passwd|secret|api_key|apikey|token|auth|bearer|private_key)\s*[:=]\s*["']?([^"',\s;]+)["']?/gi;
const AUTH_HEADER_REGEX = /(Authorization:\s*Bearer\s+)[^\s\r\n]+/gi;

export function redactTelemetryText(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let redacted = input;

  // 1. Redact Authorization headers
  redacted = redacted.replace(AUTH_HEADER_REGEX, '$1[REDACTED_TOKEN]');

  // 2. Redact Known Key Patterns (API keys, OpenAI, Google Cloud, AWS, GitHub)
  redacted = redacted.replace(API_KEY_REGEX, '[REDACTED_API_KEY]');

  // 3. Redact JWTs
  redacted = redacted.replace(JWT_REGEX, '[REDACTED_JWT]');

  // 4. Redact Key-Value passwords/secrets
  redacted = redacted.replace(PASSWORD_KV_REGEX, (match, key, val) => {
    if (typeof val === 'string' && val.startsWith('[REDACTED_')) {
      return match;
    }
    return `${key}=[REDACTED_SECRET]`;
  });

  // 5. Redact Credit Card numbers
  redacted = redacted.replace(CREDIT_CARD_REGEX, (match) => {
    // Only redact if string of digits matches credit card length (13-19 digits without delimiters)
    const digitsOnly = match.replace(/[-\s]/g, '');
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      return '[REDACTED_CARD]';
    }
    return match;
  });

  // 6. Redact SSNs
  redacted = redacted.replace(SSN_REGEX, '[REDACTED_SSN]');

  // 7. Redact Emails
  redacted = redacted.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');

  return redacted;
}

/**
 * Recursively redacts strings in objects, arrays, and primitives.
 */
export function redactTelemetryObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return redactTelemetryText(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactTelemetryObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const copy: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('cookie')
      ) {
        copy[key] = '[REDACTED_CONFIDENTIAL]';
      } else {
        copy[key] = redactTelemetryObject(val);
      }
    }
    return copy as T;
  }

  return obj;
}
