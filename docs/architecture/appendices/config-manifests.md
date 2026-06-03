# Appendix — package manifests & tsconfig (specification)

These are **specifications**, not scaffolding. Repo creation is the first build
milestone (3b). Versions are indicative (use current stable at build time); the
shape and scripts are what matters.

---

## Root `package.json`

```jsonc
{
  "name": "macronome",
  "private": true,
  "workspaces": ["packages/*"],
  "engines": { "node": ">=22" },
  "scripts": {
    "dev:api":  "npm run dev -w @macronome/api",
    "dev:web":  "npm run dev -w @macronome/web",
    "build":    "npm run build -w @macronome/shared && npm run build -w @macronome/api && npm run build -w @macronome/web",
    "lint":     "eslint .",
    "format":   "prettier --write .",
    "typecheck":"tsc -b --noEmit",
    "test":     "vitest run",
    "test:int": "vitest run -w @macronome/api --dir test/integration",
    "e2e":      "playwright test",
    "db:dev":   "docker compose -f compose.test.yml up -d",
    "migrate":  "prisma migrate deploy -w @macronome/api"
  },
  "devDependencies": {
    "typescript": "*", "eslint": "*", "@eslint/js": "*",
    "typescript-eslint": "*", "eslint-plugin-import": "*",
    "prettier": "*", "vitest": "*", "@playwright/test": "*",
    "lint-staged": "*", "husky": "*"
  }
}
```

## `tsconfig.base.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true, "noImplicitOverride": true,
    "verbatimModuleSyntax": true, "skipLibCheck": true,
    "esModuleInterop": true, "resolveJsonModule": true,
    "composite": true, "declaration": true
  }
}
```

## `packages/shared/package.json`

```jsonc
{
  "name": "@macronome/shared",
  "type": "module",
  "main": "dist/index.js", "types": "dist/index.d.ts",
  "scripts": { "build": "tsc -b", "test": "vitest run" },
  "dependencies": { "zod": "*" }
}
```

## `packages/api/package.json`

```jsonc
{
  "name": "@macronome/api",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -b",
    "start": "node dist/server.js",
    "test": "vitest run",
    "prisma:dev": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy"
  },
  "dependencies": {
    "@macronome/shared": "*",
    "express": "^5", "express-session": "*", "connect-pg-simple": "*",
    "@prisma/client": "*", "argon2": "*", "zod": "*",
    "helmet": "*", "express-rate-limit": "*", "pino": "*"
  },
  "devDependencies": { "prisma": "*", "tsx": "*", "supertest": "*" }
}
```

## `packages/web/package.json`

```jsonc
{
  "name": "@macronome/web",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@macronome/shared": "*",
    "react": "*", "react-dom": "*", "react-router-dom": "*",
    "@tanstack/react-query": "*",
    "i18next": "*", "react-i18next": "*",
    "zod": "*"
  },
  "devDependencies": {
    "vite": "*", "@vitejs/plugin-react": "*",
    "@testing-library/react": "*", "jsdom": "*"
  }
}
```

Notes:
- **TanStack Query** is the SPA's server-state layer (caching, mutations,
  invalidation) — it keeps feature `hooks/` thin and avoids hand-rolled fetch state.
  It is a client concern only; it does not move any logic out of the API.
- `packages/web/vite.config.ts` sets a dev proxy: `/api` → `http://localhost:<api>`.
- `packages/etl/package.json` mirrors `api` deps (Prisma client, shared) plus an
  xlsx reader; entry `tsx src/run.ts`.
