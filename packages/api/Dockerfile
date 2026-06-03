# syntax=docker/dockerfile:1
# Multi-stage build for the API: install workspace deps → build shared + api +
# generate Prisma client → slim runtime. The web SPA is built separately on the
# host and served by the proxy (compose.yml mounts ./packages/web/dist).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/web/package.json packages/web/package.json
COPY packages/etl/package.json packages/etl/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared packages/shared
COPY packages/api packages/api
RUN npm run build -w @macronome/shared \
 && npx prisma generate --schema packages/api/prisma/schema.prisma \
 && npm run build -w @macronome/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/web/package.json packages/web/package.json
COPY packages/etl/package.json packages/etl/package.json
RUN npm ci --omit=dev
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/api/prisma packages/api/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client node_modules/@prisma/client
WORKDIR /app/packages/api
EXPOSE 3000
# Apply migrations (idempotent, forward-only) then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
