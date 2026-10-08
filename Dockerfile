# syntax=docker/dockerfile:1
# livetich-web — Next.js 16 (standalone output). Multi-stage: install → build → run.

# ---- deps ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY package.json pnpm-lock.yaml ./
# postinstall runs this script, so it must exist before the install.
COPY scripts/copy-excalidraw-assets.mjs ./scripts/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
# NEXT_PUBLIC_* is inlined at build time, so the public API URL must be known
# here (passed as a build arg from compose). See deploy/DEPLOY.md.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The deps stage's copy of the Excalidraw fonts landed in its own public/, which
# isn't carried over (and public/excalidraw-assets is gitignored), so copy again
# here or the board falls back to fetching fonts from a CDN.
RUN node scripts/copy-excalidraw-assets.mjs
# Raise Node's heap ceiling for the build. On small hosts (e.g. a 1 GB VPS)
# Node auto-tunes max-old-space low (~512 MB) and the Next.js build OOMs; this
# lets it use available RAM + swap. Scoped to this build step only.
RUN NODE_OPTIONS="--max-old-space-size=2048" pnpm build

# ---- runner: ship only the traced standalone server ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
