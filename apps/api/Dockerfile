# syntax=docker/dockerfile:1.7

# ---- build stage --------------------------------------------------------
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /repo

# Lockfile + workspace declarations first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Sources for the slices we actually build
COPY packages/types packages/types
COPY apps/api apps/api

RUN pnpm --filter @auction/types build
RUN pnpm --filter @auction/api db:generate
RUN pnpm --filter @auction/api build

# Trim to production deps for the runtime image
RUN pnpm --filter @auction/api --prod deploy /deploy

# pnpm deploy reinstalls deps from the lockfile without lifecycle artifacts,
# so the Prisma client generated in the build node_modules above isn't carried
# over. Regenerate inside /deploy so the runtime image has the artifacts.
RUN cd /deploy && ./node_modules/.bin/prisma generate

# ---- runtime stage ------------------------------------------------------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# `pnpm deploy` produces a self-contained app folder with hoisted prod deps.
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /deploy/dist ./dist
COPY --from=build /deploy/prisma ./prisma
COPY --from=build /deploy/package.json ./package.json

EXPOSE 3000
# Run pending migrations on every container start, then start the API.
# `prisma migrate deploy` is idempotent (checks _prisma_migrations table),
# so on a no-op deploy it costs <1s. `exec` ensures SIGTERM from the host
# propagates to Node instead of being trapped by the shell.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
