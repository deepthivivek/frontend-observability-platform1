import type { NextRequest } from 'next/server';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1', '[::1]']);

/**
 * Resolves BACKEND_GATEWAY_URL only if it points to a distinct external backend
 * gateway and not back to this Next.js server process (preventing infinite self-proxy loops).
 */
export function resolveUpstreamGatewayUrl(req: NextRequest): string | null {
  if (req.headers.get('x-neon-chasm-proxied') === '1') {
    return null;
  }

  const raw = process.env.BACKEND_GATEWAY_URL?.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    const localPort = String(process.env.PORT || '3000');
    const targetPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');

    const incomingHost = req.headers.get('host') || req.nextUrl.host;
    if (incomingHost && parsed.host === incomingHost) {
      return null;
    }

    if (LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase()) && targetPort === localPort) {
      return null;
    }

    return raw.replace(/\/$/, '');
  } catch {
    return null;
  }
}
