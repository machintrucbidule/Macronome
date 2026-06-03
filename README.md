# Macronome

Self-hosted, internet-facing, API-first nutrition & weight tracker that replaces a
mature daily-use Excel workbook. It must match or exceed that workbook from v1.

## Repository orientation

- **`CLAUDE.md`** — start here (agent entry point): how to run/test/build, the rules,
  where everything lives, the change workflow.
- **`ARCHITECTURE.md`** + **`docs/architecture/`** — how the system is built
  (topology, stack, repo & module map, modularity rules, testing, ops, security,
  plus config appendices and per-package context files).
- **`SETUP.md`** — Windows-11 environment readiness; run it before the first build.
- **`DEV_PLAN.md`** — the living build checklist (milestones + acceptance criteria);
  the agent ticks items as it builds.
- **`spec/`, `design/`, `DECISIONS.md`** — the FIXED contracts, **git-synced** and
  shareable: logical contract (`spec/`), visual contract (`design/`), resolved
  decisions (`DECISIONS.md`). `spec/logic/*` ships **neutral** worked examples used as
  CI oracles. Implement against these; never edit them to fit the code.
- **`specifications/`** — the personal/provenance authority (screen specs, mockups,
  masterplan, reconciliation/gap logs, the source workbook, real-value test data).
  **Git-ignored** (contains personal data): present in the local working copy, never
  pushed. A fresh clone will not contain it.
- **`packages/`**, config files, `e2e/` — created at build milestone M0; not
  scaffolded yet.

## Phases

- **2b** — logical contract (schema / API / domain logic). → `spec/`
- **2c** — visual contract (tokens / components / theming). → `design/`
- **3a** — this architecture phase (the docs above). ✅
- **3b** — build sequence, milestones, acceptance criteria → fills `DEV_PLAN.md`. ⏳

## Stack (finalised — see `ARCHITECTURE.md`)

Monorepo (npm workspaces: `api` · `web` · `shared`) · Node + TypeScript + Express 5 ·
PostgreSQL + Prisma · React + Vite · Zod · i18next · server-side sessions (argon2id) ·
Vitest + Playwright · Docker Compose (deployment-agnostic).

> Status: phase 3a complete. No application code yet — repo scaffolding is the first
> build milestone (3b).
