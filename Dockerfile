# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Stage 1: Dependencies & Production Next.js Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* bun.lock* ./
RUN npm ci --ignore-scripts

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Hardened Distroless-Style Non-Root Alpine Runtime
# Compatible with Kubernetes Restricted PSS & readOnlyRootFilesystem: true
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV GATEWAY_PORT=4000
ENV NEON_CHASM_STATE_DIR=/tmp/neon-chasm-state

RUN addgroup -g 1001 -S neonchasm \
  && adduser -u 1001 -S neonchasm -G neonchasm \
  && mkdir -p /tmp/neon-chasm-state /var/lib/neon-chasm-state \
  && chown -R 1001:1001 /app /tmp/neon-chasm-state /var/lib/neon-chasm-state

# Install lightweight tsx/runtime executor for backend gateway alongside Next.js standalone
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/static
COPY --from=builder --chown=1001:1001 /app/public ./public
COPY --from=builder --chown=1001:1001 /app/server ./server
COPY --from=builder --chown=1001:1001 /app/node_modules ./node_modules

USER 1001:1001

EXPOSE 3000 4000

HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.GATEWAY_PORT || 4000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
