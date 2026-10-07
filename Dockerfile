# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# DataVault web — Next.js 16 (App Router) multi-stage build.
#
# Targets:
#   deps    : install dependencies with bun (bun.lock is committed)
#   builder : prisma generate + next build (standalone output)
#   seed    : full source image used by the one-shot `web-seed` compose service
#             (pushes the Prisma/SQLite schema and runs scripts/seed.ts)
#   runner  : final image — Next.js standalone server on node:20-slim, port 3000
#
# Build arg:
#   NEXT_PUBLIC_API_URL — "" (default) = embedded demo engine ("sandbox mode":
#                         the TS federated-learning engine, local hash-chain
#                         ledger and SQLite demo data run inside the web app).
#                         Set to e.g. http://localhost:8000 to point the web
#                         app at the FastAPI backend (services/api).
#                         NOTE: Next.js inlines NEXT_PUBLIC_* variables into the
#                         client bundle at BUILD time — changing the value
#                         requires `docker compose build web`.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. dependencies ──────────────────────────────────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ── 2. build ─────────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/app/db/custom.db
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json next.config.ts postcss.config.mjs tailwind.config.ts eslint.config.mjs components.json ./
COPY prisma ./prisma
COPY public ./public
COPY src ./src

ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Prisma client (schema lives in prisma/schema.prisma; SQLite provider)
RUN bunx prisma generate

# next build with output: "standalone" (next.config.ts), then the repo's build
# script copies .next/static and public into the standalone bundle
RUN bun run build

# ── 3. seed target (full source; used by the web-seed compose service) ───────
FROM oven/bun:1 AS seed
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/app/db/custom.db
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
# /app/db and /app/data are compose volumes (shared with the web service)
RUN mkdir -p /app/db /app/data
# push the schema, then run the real demo seed (orgs, users, datasets,
# models + historical federated training runs — see scripts/seed.ts)
CMD ["sh", "-c", "bunx prisma db push --accept-data-loss && bun scripts/seed.ts"]

# ── 4. runtime (default target) ──────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/db/custom.db

# libssl for the Prisma query engine on debian slim
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# standalone server + traced node_modules (includes the Prisma client/engine,
# built for debian in the builder stage — same platform family as node:20-slim)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# runtime state of the embedded demo engine (SQLite db + participant CSVs),
# mounted as volumes by docker-compose and pre-seeded by the web-seed service
RUN mkdir -p /app/db /app/data && chown -R nextjs:nodejs /app/db /app/data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
