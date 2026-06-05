# syntax=docker/dockerfile:1
# Combined image (ADR-0001): builds shared + api + web, then the API process serves
# BOTH the static SPA (packages/web/dist) and /api/v1 on one port. No separate proxy
# image and no host-side web build — `docker compose up -d` just pulls this image.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/web/package.json packages/web/package.json
COPY packages/etl/package.json packages/etl/package.json
# Drop the `prepare: husky` lifecycle: there is no git repo in the build context and
# husky isn't needed to build/run; this also keeps the --omit=dev stage from failing.
RUN npm pkg delete scripts.prepare && npm ci

FROM deps AS build
COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared packages/shared
COPY packages/api packages/api
COPY packages/web packages/web
RUN npm run build -w @macronome/shared \
 && npx prisma generate --schema packages/api/prisma/schema.prisma \
 && npm run build -w @macronome/api \
 && npm run build -w @macronome/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Absolute path to the SPA build the API serves (consumed by config/env.ts).
ENV WEB_DIST=/app/packages/web/dist
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/web/package.json packages/web/package.json
COPY packages/etl/package.json packages/etl/package.json
RUN npm pkg delete scripts.prepare && npm ci --omit=dev
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/api/prisma packages/api/prisma
COPY --from=build /app/packages/web/dist packages/web/dist
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client node_modules/@prisma/client
WORKDIR /app/packages/api
EXPOSE 3000
# Apply migrations (idempotent, forward-only) then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
