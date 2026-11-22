'use client';

export interface NeonChasmSettings {
  otlpEndpoint: string;
  wsUrl: string;
  sseUrl: string;
  tenantId: string;
  tenantApiKey: string;
  latencyWarnMs: number;
  latencyCritMs: number;
  errorRateThresholdPct: number;
}

export const DEFAULT_NEON_CHASM_SETTINGS: NeonChasmSettings = {
  otlpEndpoint: '/api/v1/telemetry',
  wsUrl: '',
  sseUrl: '/api/v1/stream/telemetry',
  tenantId: 'default-tenant',
  tenantApiKey: '',
  latencyWarnMs: 200,
  latencyCritMs: 300,
  errorRateThresholdPct: 5,
};

const SETTINGS_STORAGE_KEY = 'neon_chasm_runtime_settings_v1';

export function loadNeonChasmSettings(): NeonChasmSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_NEON_CHASM_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_NEON_CHASM_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<NeonChasmSettings>;
    return {
      ...DEFAULT_NEON_CHASM_SETTINGS,
      ...parsed,
      latencyWarnMs:
        typeof parsed.latencyWarnMs === 'number' && !Number.isNaN(parsed.latencyWarnMs)
          ? parsed.latencyWarnMs
          : DEFAULT_NEON_CHASM_SETTINGS.latencyWarnMs,
      latencyCritMs:
        typeof parsed.latencyCritMs === 'number' && !Number.isNaN(parsed.latencyCritMs)
          ? parsed.latencyCritMs
          : DEFAULT_NEON_CHASM_SETTINGS.latencyCritMs,
      errorRateThresholdPct:
        typeof parsed.errorRateThresholdPct === 'number' && !Number.isNaN(parsed.errorRateThresholdPct)
          ? parsed.errorRateThresholdPct
          : DEFAULT_NEON_CHASM_SETTINGS.errorRateThresholdPct,
    };
  } catch {
    return DEFAULT_NEON_CHASM_SETTINGS;
  }
}

export function saveNeonChasmSettings(next: NeonChasmSettings): NeonChasmSettings {
  const sanitized: NeonChasmSettings = {
    ...DEFAULT_NEON_CHASM_SETTINGS,
    ...next,
    otlpEndpoint: (next.otlpEndpoint || DEFAULT_NEON_CHASM_SETTINGS.otlpEndpoint).trim(),
    sseUrl: (next.sseUrl || DEFAULT_NEON_CHASM_SETTINGS.sseUrl).trim(),
    tenantId: (next.tenantId || DEFAULT_NEON_CHASM_SETTINGS.tenantId).trim(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
      window.dispatchEvent(new CustomEvent('neon-chasm-settings-updated', { detail: sanitized }));
    } catch {
      // Ignore storage quota errors
    }
  }
  return sanitized;
}

export function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createW3cTraceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(32, '0').slice(0, 32);
}

export function buildCorrelationHeaders(extra?: Record<string, string>): Record<string, string> {
  const settings = loadNeonChasmSettings();
  const requestId = createCorrelationId();
  const traceId = createW3cTraceId();

  const headers: Record<string, string> = {
    'X-Request-ID': requestId,
    'X-Trace-ID': traceId,
    'X-Tenant-ID': settings.tenantId || 'default-tenant',
    ...(extra || {}),
  };

  if (settings.tenantApiKey) {
    headers['Authorization'] = `Bearer ${settings.tenantApiKey}`;
  }

  return headers;
}

export interface SafeJsonResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

/**
 * Safely fetches JSON from an API route. Always checks Content-Type before parsing JSON
 * so HTML 404/500 responses never trigger `Unexpected token '<'` crashes.
 */
export async function safeApiFetchJson<T = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeJsonResponse<T>> {
  try {
    const res = await fetch(input, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.toLowerCase().includes('application/json');

    if (isJson) {
      const parsed = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data: parsed,
          error: (parsed && typeof parsed.error === 'string' && parsed.error) || `Request failed (HTTP ${res.status})`,
        };
      }
      return {
        ok: true,
        status: res.status,
        data: parsed,
        error: null,
      };
    }

    const text = await res.text().catch(() => '');
    const cleanedPreview = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    return {
      ok: false,
      status: res.status,
      data: null,
      error: res.ok
        ? 'Unexpected non-JSON response received from server.'
        : `Server returned non-JSON error (HTTP ${res.status})${cleanedPreview ? `: ${cleanedPreview}` : ''}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Network error reaching backend API.',
    };
  }
}

let fetchInterceptorInstalled = false;

/**
 * Installs an idempotent same-origin fetch wrapper that ensures every API/health request
 * automatically includes X-Request-ID, X-Trace-ID, X-Tenant-ID, credentials, and emits
 * a mid-session expiry event when protected API calls return HTTP 401.
 */
export function installCorrelationFetchInterceptor(): () => void {
  if (typeof window === 'undefined' || fetchInterceptorInstalled) {
    return () => {};
  }

  const rawFetch = window.fetch;
  if (typeof rawFetch !== 'function') {
    return () => {};
  }

  const ownDescriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
  if (ownDescriptor && ownDescriptor.configurable === false) {
    return () => {};
  }

  const boundFetch = rawFetch.bind(window);
  const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    const isSameOriginApi =
      urlStr.startsWith('/api/') ||
      urlStr === '/healthz' ||
      urlStr === '/readyz' ||
      (typeof window.location !== 'undefined' &&
        urlStr.startsWith(window.location.origin) &&
        (urlStr.includes('/api/') || urlStr.endsWith('/healthz') || urlStr.endsWith('/readyz')));

    if (!isSameOriginApi) {
      return boundFetch(input, init);
    }

    const headers = new Headers(
      init?.headers || (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined)
    );
    const settings = loadNeonChasmSettings();

    if (!headers.has('X-Request-ID')) {
      headers.set('X-Request-ID', createCorrelationId());
    }
    if (!headers.has('X-Trace-ID')) {
      headers.set('X-Trace-ID', createW3cTraceId());
    }
    if (!headers.has('X-Tenant-ID')) {
      headers.set('X-Tenant-ID', settings.tenantId || 'default-tenant');
    }
    if (settings.tenantApiKey && !headers.has('Authorization') && !urlStr.includes('/api/v1/auth/')) {
      headers.set('Authorization', `Bearer ${settings.tenantApiKey}`);
    }

    const hadExplicitAuthHeader = Boolean(
      init?.headers &&
        new Headers(init.headers).has('Authorization')
    );

    const res = await boundFetch(input, {
      ...init,
      credentials: init?.credentials || 'include',
      headers,
    });

    if (
      res.status === 401 &&
      !hadExplicitAuthHeader &&
      !urlStr.includes('/api/v1/auth/')
    ) {
      void boundFetch('/api/v1/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      })
        .then(async (sessionRes) => {
          const ct = sessionRes.headers.get('content-type') || '';
          if (sessionRes.ok && ct.toLowerCase().includes('application/json')) {
            const payload = (await sessionRes.json().catch(() => null)) as { authenticated?: boolean } | null;
            if (payload && payload.authenticated === false) {
              window.dispatchEvent(new CustomEvent('neon-chasm-session-expired'));
            }
          }
        })
        .catch(() => {});
    }

    return res;
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: wrappedFetch,
      configurable: true,
      writable: true,
      enumerable: ownDescriptor?.enumerable ?? true,
    });
    fetchInterceptorInstalled = true;
  } catch {
    fetchInterceptorInstalled = false;
    return () => {};
  }

  return () => {
    try {
      if (ownDescriptor) {
        Object.defineProperty(window, 'fetch', ownDescriptor);
      } else {
        delete (window as { fetch?: unknown }).fetch;
      }
    } catch {
      // Ignore cleanup errors if environment locks window.fetch
    } finally {
      fetchInterceptorInstalled = false;
    }
  };
}
