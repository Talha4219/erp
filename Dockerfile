# syntax=docker/dockerfile:1

# ─── deps: install all dependencies (incl. dev, needed for the build) ──────────
FROM node:20-alpine AS deps
# openssl + libc6-compat are required by the Prisma query engine on Alpine (musl)
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── builder: generate Prisma client, then build Next.js ──────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client (and its native query engine) must exist before `next build`
RUN npx prisma generate

# NEXT_PUBLIC_* values are inlined into the client bundle at build time
ARG NEXT_PUBLIC_APP_NAME="ERP"
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholders so the build never attempts real DB connections or secret checks.
# Real values are supplied at runtime via docker-compose / -e flags.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
ENV NEXTAUTH_SECRET="build-time-placeholder"
RUN npm run build

# ─── runner: minimal production image ──────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl wget
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Public assets
COPY --from=builder /app/public ./public
# Next.js build output
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
# Custom server with compression (replaces the default standalone server)
COPY server.js ./
# Production dependencies (compression, next, react, prisma client, etc.)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Prisma generated client + native query engine
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

# /login is a public route — a 200 here means the server is up
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
