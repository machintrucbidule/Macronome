**English** · [Français](README_FR.md)

# Macronome

Self-hosted, API-first **nutrition & weight tracker** that replaces a daily-use Excel
workbook. Log what you eat, see your calories and macros against your own targets, track
your weight trend toward a goal, and review your adherence over time — all on your own
server, for a single owner.

![Macronome — daily meal log](docs/img/preview.png)

---

## What is Macronome?

Macronome turns the spreadsheet many people keep for dieting into a fast, dense web app:

- **Log meals** by food and quantity. Each day sums calories and the three macros
  (fat, carbs, protein) and compares them to **your** target band — giving a clear
  **OK / NOK** verdict for the day.
- **Track your weight** with real weigh-ins, a smoothed trend, a goal trajectory, BMI,
  and a projected goal date.
- **Understand your adherence** with rolling averages, an OK-rate heatmap, monthly
  charts, and plain-language signals.

Two principles run through it:

- **The server computes; the browser only renders.** Verdicts, burns, totals, EMA, BMI,
  proration — everything is computed on the API and read by the SPA.
- **History is frozen.** Each logged day stores a snapshot of its targets and food macros.
  Editing a food, a recipe, or a target later only affects **future** days — your past is
  never silently rewritten.

Other essentials: **SI units** (grams internally), **French / English** UI, **light / dark**
theme, and **single-owner** self-hosting (no public sign-up).

---

## Features

### Repas — daily food log

The home screen. Organize the day into meal slots (breakfast, lunch, snack, dinner…) and
log each food by name with a quantity and unit (g/ml/kg or a **named portion** like
"1 egg = 57 g"). Highlights:

- **Autocomplete** food/recipe search; **arithmetic** in quantity fields (`950/2` → 475).
- **Pantry pins (📌)** pre-fill recurring foods into a meal every day.
- **Copy yesterday** and **Clear day** shortcuts; a free-text **day comment**.
- **Activity level** per day drives an estimated burn; the **OK/NOK verdict** is computed
  from your calorie target and can be manually overridden.
- **Complet / Partiel** day kinds: full detailed logging, or a calorie-only summary day.
- **Leftover proration** ("plate mode"): when several foods share a plate, enter the gross
  weight + container tare and Macronome distributes the leftover proportionally.
- **Cook mode** 🍳: a touch-friendly, keyboard-free modal for adjusting real cooked weights.
- **Custom foods** for one-off manual entries, and **macro cards** showing each macro vs its
  target band.

### Journal — day history

A bird's-eye, sortable list of every logged day, with red / yellow / green state bands
(no-data / summary / detailed). Jump into any day, fix verdicts or activity, inline-edit
calorie totals, and pick a year (bounded to years that actually have data).

### Poids — weight & trend

Record weigh-ins (weight, optional waist, a "in diet / maintenance" flag, a note). The chart
overlays real points, an **EMA-smoothed trend**, a **target trajectory**, and the goal line.
Stat cards show current weight and Δ, **BMI** with category, gap to goal, and a **projected
goal date**. A per-period table breaks down average intake, estimated and empirical burn, and
the daily deficit between weigh-ins.

### Aliments — food database

Browse, search, create, rate, and archive foods. Each food has macros per 100 g, optional
**named portions**, a 0–3 **rating**, and a private/shared visibility flag. The **"Parser
macro"** tool lets you **paste a nutrition table copied from a grocery site** and auto-fills
the per-100 g values (kcal / fat / carbs / protein).

### Recettes — recipes

Build recipes from foods **and** other recipes (nested, cycle-checked). Set the batch weight
(defaults to the ingredient sum, overridable to the measured cooked weight) and the number of
servings; Macronome derives per-100 g and per-portion macros and exposes the recipe as a
loggable food with a "portion" unit.

### Cibles — targets & metabolic engine

Set your daily **calorie min/max** and macro **floors in g/kg** (protein, fat); the **carb
ceiling is derived** from what's left. A read-only metabolic engine shows your **BMR**
(Mifflin-St Jeor), activity-based **estimated burn**, **empirical burn** from real weight loss,
and the **deficit** at your target — plus clickable **g/kg guidance presets** and a derived
**target BMI**. Targets are **versioned** with effective dates and an opt-in recompute of past
auto-verdicts.

### Stats — adherence & trends

Rolling **7 / 14 / 30 / 365-day** calorie averages (each judged against its own window's target),
a yearly **OK-rate** with an adherence **heatmap**, **monthly** OK/NOK bars and average-calorie
charts, and rule-based **signals**. Unlogged and future days are excluded from rates — never
counted as failures.

### Garde-manger — pantry

A live, global list of recurring foods pinned per meal slot. Pinning adds the food (at qty 0)
to today and future days and pre-fills new days; the same list is editable from both Settings
and the Repas pin.

### Paramètres — settings

Theme, language, and the default meal structure. The **Data** section exports your full content
to a versioned JSON file, **imports** one back (a full replace/restore), or **wipes** all tracked
data — credentials are never exported or wiped.

### Compte / À propos

Manage credentials and your metabolic profile (sex, birthdate, height); view the app version and
live server diagnostics (Node.js, uptime, OS, CPU, memory, database size).

### Setup & login

On a fresh install a **first-run setup wizard** creates the single owner account (no public
sign-up). Login is rate-limited with lockout backoff and keeps you signed in across restarts.

---

## How it works (key behaviours)

- **Server-side computation** — the web app reads computed figures; it never recomputes a
  nutrition number.
- **Frozen snapshots** — past days keep their target + macro snapshots; later edits only affect
  future days.
- **Calorie-based auto verdict** with manual override; macro tiles are quality indicators, not
  verdict drivers.
- **SI units** everywhere, with consistent display rounding.
- **i18n** (FR/EN) for UI strings; food/recipe/portion names stay as your data.
- **Single-owner self-hosting**; you front it with your own reverse proxy / TLS.

---

## Tech stack

npm-workspaces monorepo (`shared` · `api` · `web`) · **Node 22** + TypeScript + **Express 5** ·
**PostgreSQL 17** + **Prisma** · **React 18** + **Vite 6** · **Zod** · **i18next** ·
server-side sessions (**argon2id**) · **Vitest** + **Playwright** · **Docker**.

The API process serves **both** the static SPA and `/api/v1` on a single port, so production is
one prebuilt image.

---

## Install — Docker (recommended)

Macronome ships as a single prebuilt image on GHCR and runs **zero-config**: every setting has a
safe default. See [`compose.yml`](compose.yml).

```bash
# In a folder containing compose.yml:
docker compose up -d
```

This pulls `ghcr.io/machintrucbidule/macronome:latest` and starts two services — the app and
`postgres:17` — with data on Docker-managed named volumes (`pgdata` for the database, `appdata`
for the auto-generated session secret). The app listens on **port 3000** (host port set by
`APP_PORT`). The container entrypoint runs `prisma migrate deploy` and then starts the server.
In **Portainer**, paste the same file as a stack and "deploy".

**First run.** Open the app in a browser and complete the **setup wizard** to create the single
owner account. As a CLI fallback (e.g. headless):

```bash
npm run create-user -w @macronome/api -- \
  --username you --password 'secret' --sex male --birthdate 1990-01-01 --height 180
```

**Reverse proxy / TLS.** The app serves plain HTTP on its port — front it with your own reverse
proxy (Nginx Proxy Manager, Traefik, Caddy, Cloudflare Tunnel…) that terminates TLS. The health
probe is `GET /api/v1/health`. To use `Secure` cookies behind your proxy, set
`COOKIE_SECURE=true` **and** `TRUSTED_PROXY=<your proxy's address/CIDR>`.

**Backups.** The only critical state is the `pgdata` volume — back it up (e.g. `pg_dump`) before
upgrades.

### Configuration (all optional — defaults shown)

Copy [`.env.example`](.env.example) to `.env` and uncomment only what you want to override.

| Variable            | Default            | Purpose                                                              |
| ------------------- | ------------------ | -------------------------------------------------------------------- |
| `MACRONOME_TAG`     | `latest`           | Image tag to deploy (`latest` or `vX.Y.Z`).                          |
| `APP_PORT`          | `3000`             | Host port mapped to the app.                                         |
| `POSTGRES_DB`       | `macronome`        | Database name.                                                       |
| `POSTGRES_USER`     | `macronome`        | Database user.                                                       |
| `POSTGRES_PASSWORD` | `macronome`        | Database password (Postgres is internal-only, not exposed).          |
| `SESSION_SECRET`    | _(auto-generated)_ | Cookie signing key; generated & persisted on first boot if unset.    |
| `COOKIE_SECURE`     | `false`            | Mark session cookies `Secure` (set with `TRUSTED_PROXY`).            |
| `TRUSTED_PROXY`     | `loopback`         | Your reverse proxy's address/CIDR (real client IP + Secure cookies). |

---

## Install — manual (without Docker)

Requirements: **Node ≥ 22** and a reachable **PostgreSQL 17**.

```bash
# 1. Install dependencies
npm install

# 2. Generate the Prisma client
npm run prisma:generate -w @macronome/api

# 3. Build everything (shared → api → web)
npm run build

# 4. Configure the environment (example)
export DATABASE_URL="postgresql://user:password@localhost:5432/macronome"
export NODE_ENV=production
export WEB_DIST="$(pwd)/packages/web/dist"   # absolute path to the built SPA
export PORT=3000                              # optional
# export SESSION_SECRET="..."                 # optional; auto-generated & persisted if unset

# 5. Apply database migrations
npm run migrate

# 6. Start the server (serves the SPA + /api/v1 on PORT)
npm run start -w @macronome/api
```

The single API process serves the built SPA from `WEB_DIST` and the `/api/v1` endpoints on the
same port (see [`packages/api/src/http/spa.ts`](packages/api/src/http/spa.ts)). Open
`http://localhost:3000` and complete the setup wizard (or use the `create-user` script above).
Put your own HTTPS reverse proxy in front for internet exposure.

---

## Development setup

```bash
# 1. Install
npm install

# 2. Start a local dev database (persistent, Postgres on port 5434)
docker compose -f compose.dev.yml up -d

# 3. Point the API at it — create packages/api/.env:
#    DATABASE_URL=postgresql://macronome:dev@localhost:5434/macronome

# 4. Generate the Prisma client, then apply migrations
npm run prisma:generate -w @macronome/api
npm run migrate

# 5. Run the API and the web dev server (two terminals)
npm run dev:api    # Express API on http://127.0.0.1:3000
npm run dev:web    # Vite SPA on http://127.0.0.1:5173 (proxies /api → 3000)
```

Open **http://127.0.0.1:5173**. Both sides hot-reload.

> Generate the Prisma client **before** `lint`/`typecheck` — the type-aware rules and `tsc` need
> the generated client.

### Quality gate

| Task              | Command                                                    |
| ----------------- | ---------------------------------------------------------- |
| Type-check        | `npm run typecheck`                                        |
| Lint              | `npm run lint`                                             |
| Unit tests        | `npm test`                                                 |
| Integration tests | `npm run db:dev` (test DB on 5433) then `npm run test:int` |
| End-to-end tests  | `npm run e2e`                                              |
| Build all         | `npm run build`                                            |

`npm run db:dev` starts the **ephemeral** test database (Postgres on **5433**); the dev database
from `compose.dev.yml` is separate (**5434**) so both can run at once.

---

## Project structure

| Path              | What it is                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared` | DTO Zod schemas + types and domain constants (energy 9/4/4, activity multipliers…). No logic.                              |
| `packages/api`    | Express + Prisma backend — the **only** place business logic lives (`domain` · `services` · `data/repositories` · `http`). |
| `packages/web`    | React + Vite SPA. **Renders, never computes.** One folder per screen under `features/`.                                    |
| `packages/etl`    | Legacy Excel → DB migration stub, **superseded** by the in-app Settings → import. Not built/run.                           |

The product is defined by fixed, git-synced **contracts**: `spec/` (data schema, API, domain
logic with worked numeric examples), `design/` (design tokens + components), and `DECISIONS.md`.
Architecture docs live in `ARCHITECTURE.md` + `docs/architecture/`.

---

## Versioning

The annotated git tag `vX.Y.Z` is the single source of truth for the app version (ADR-0002). It
flows to the Docker image tags (`:vX.Y.Z`, `:vX.Y`, `:latest`) and is baked into the image as
`APP_VERSION`, surfaced at `GET /api/v1/health` and on the **À propos** screen.
