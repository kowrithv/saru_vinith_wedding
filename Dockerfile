# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Runtime ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && apk add --no-cache su-exec

# Runtime data written by the app at startup (JSON "db" files + guest uploads).
# These directories are meant to be mounted as volumes on the server so data
# survives image updates/redeploys.
COPY --from=builder /app/data ./data
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker-entrypoint.sh ./

RUN mkdir -p ./public/uploads \
    && chown -R nextjs:nodejs ./data ./public \
    && chmod +x ./docker-entrypoint.sh

# Stays root here on purpose: the entrypoint fixes ownership of the mounted
# ./data and ./public/uploads volumes on every start (host-created bind mounts
# don't necessarily land as uid 1001) before dropping to "nextjs" to run node.
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/settings').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
