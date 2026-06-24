# fastrak — production image for the fastrak web app.
# Multi-stage so the final image carries only what it needs to RUN (no compiler,
# no dev dependencies): build once, ship a small runtime.

FROM node:20-alpine AS base
WORKDIR /app

# ── All dependencies (needed to build) ──────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Build the Next.js app ───────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Production dependencies only (no typescript/vitest/types) ────────────────
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Runtime image ───────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.mjs ./
# Schema + scripts are needed at startup to migrate and seed the database.
COPY db ./db
COPY scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh && chown -R node:node /app
USER node

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
