**English** · [Français](README_FR.md)

# Macronome

Self-hosted, API-first **multi-user nutrition & weight tracker** that replaces a daily-use
Excel workbook. Log what you eat, see your calories and macros against your own targets,
track your weight trend toward a goal, and review your adherence over time — all on your own
server. An **admin owner** runs the instance and can invite additional accounts, each with
fully **isolated** data; there is **no public sign-up**.

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
- **Optional AI assist** — connect your own OpenAI-compatible model (e.g. Gemini) to
  estimate a dish's macros from a photo, suggest meals that fit your remaining targets, and
  generate written advice from your own logged data.

Two principles run through it:

- **The server computes; the browser only renders.** Verdicts, burns, totals, EMA, BMI,
  proration — everything is computed on the API and read by the SPA.
- **History is frozen.** Each logged day stores a snapshot of its targets and food macros.
  Editing a food, a recipe, or a target later only affects **future** days — your past is
  never silently rewritten.

Other essentials: **SI units** (grams internally), **French / English** UI, **light / dark**
theme, and **multi-user** self-hosting — an admin owner plus invited accounts, isolated per
user, with no public sign-up.

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
- **Undo / redo** (Ctrl+Z / Ctrl+Y) for line edits — add/remove, quantity, unit, pin, reorder.
- **Selected-line sum** (desktop): tick any subset of food lines and read a running total of
  grams / kcal / macros, spreadsheet-status-bar style.
- **AI assist (optional)**: estimate a dish's macros from a photo, or get **meal proposals**
  that fill the day's remaining target band (see _Assistant IA_).

### Journal — day history

A bird's-eye, sortable list of every logged day, with red / yellow / green state bands
(no-data / summary / detailed). Jump into any day, fix verdicts or activity, inline-edit
calorie totals, and pick a year (bounded to years that actually have data). Export the
history to **CSV** (one recap row per logged day, across all years).

### Poids — weight & trend

Record weigh-ins (weight, optional waist, a "in diet / maintenance" flag, a note). The chart
overlays real points, an **EMA-smoothed trend**, a **target trajectory**, and the goal line.
Stat cards show current weight and Δ, **BMI** with category, gap to goal, and a **projected
goal date**. A per-period table breaks down average intake, estimated and empirical burn, and
the daily deficit between weigh-ins. Export every weigh-in to **CSV**.

### Aliments — food database

Browse, search, create, rate, and archive foods. Each food has macros per 100 g, optional
**named portions**, a 0–3 **rating**, and a private/shared visibility flag. The **"Parser
macro"** tool lets you **paste a nutrition table copied from a grocery site** and auto-fills
the per-100 g values (kcal / fat / carbs / protein).

### Recettes — recipes

Build recipes from foods **and** other recipes (nested, cycle-checked). Set the batch weight —
in **Auto** mode it tracks the live ingredient sum, or switch to **manual** to enter the
measured cooked weight — and the number of servings; Macronome derives per-100 g and per-portion
macros and exposes the recipe as a loggable food with a "portion" unit.

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

### Contenants — reusable containers

A per-user catalogue of named vessels with an **empty ("tare") weight** — a plate at 650 g, a
bowl at 408 g. They feed the **leftover proration** on the daily log: when several foods share
a plate, you enter the gross weight and pick a container, and Macronome subtracts its tare
before distributing the leftover. A built-in **"Rien" (0 g)** is always available; the rest is
yours to edit. Editing or deleting a container never rewrites past days — each logged leftover
freezes the tare it used.

### Assistant IA — optional AI assistant

Connect your own **OpenAI-compatible** endpoint (e.g. Google Gemini) from a dedicated page: a
base URL and an API key (stored write-only, never echoed back), verified by **listing the
provider's models**. Each AI task has its own **model** and an editable **prompt**:

- **Photo → macros** — from the meal log, upload one to four dish photos (plus an optional note)
  and a vision model estimates the macros; the default prompt leans slightly pessimistic
  (prefers a small over-estimate).
- **Meal proposals** — ask for foods and quantities that fill the day's **remaining target
  band**; proposals are aware of what you've already eaten, are **refinable** (pin and adjust
  quantities), and show a graceful "already on target" state when there's nothing to add.

A shared **allergies / disliked-foods** field steers both the meal proposals and the advice
(below) away from foods you avoid, and each task shows an **estimated per-request cost** across
common models so there are no billing surprises.

The whole feature is **opt-in**: Macronome works fully without it, and nothing leaves your
server until you configure a connection.

### Conseils IA — AI coaching

A dedicated page turns your own data into **written advice**. On demand — one paid model call
per press — a text model reads an anonymised digest of your picture (profile and metabolic
figures, current and past targets, your weight / BMI / waist trend, rolling intake, monthly
adherence over all history, and the last 30 days of journal and meals) and replies in **Markdown**,
in your UI language. It judges balance **over your average, not meal by meal**, and flags
qualitative **deficiency risks** inferred from food names (few oily-fish / omega-3 sources,
little fibre…) — always with the honest caveat that Macronome tracks only calories and macros,
**not micronutrients**. Every generation is **archived** as a collapsible card (delete behind a
confirm). It reuses your AI connection with its own model and editable prompt. Advice deliberately
sends more of your data than the other AI uses; it never sends credentials, other users' data, or
your free-text comments.

### Intégrations — local-network services

Connect services from your own network. Their secrets stay **server-side** (the browser never
talks to them directly), so they also work when you're away from home.

- **Home Assistant** — import your latest smart-scale reading. Point Macronome at your Home
  Assistant URL, a long-lived token, and the weight sensor's entity id; an **"Import from HA"**
  button then pre-fills a weigh-in with the rounded measurement (SI, kg only).
- **BarclaudeGateway** — a self-hosted gateway to a grocery product database (Chronodrive). Once
  configured, a **product search** appears in the add-food modal and pre-fills a food's name and
  per-100 g macros from a scanned product.

### Paramètres — settings

Theme, language, and the default meal structure (meal slots and how many lines each meal shows).
The **Data** section exports your full content to a versioned JSON file, **imports** one back (a
full replace/restore), or **wipes** all tracked data — credentials are never exported or wiped.

An optional **automatic Google Drive backup** uploads that same export to **your own** Drive:
bring your own Google OAuth client, connect once, then set a retention window and a daily time —
fired at **your** local time, within a minute of it — plus a manual "backup now". Note that the
backup file is **not encrypted** and contains your stored secrets (Drive / AI / Home Assistant
tokens) in clear, so keep that Drive folder private; connecting requires serving the app over
HTTPS.

### Utilisateurs — accounts (admin)

Admins get a **Utilisateurs** page to manage accounts: each account's role and usage (created,
last login, last activity), **invite** a new user with a single-use 7-day link (choosing their
role), generate a **password-reset link**, promote / demote admins, or delete an account (which
**wipes that account's data**). Safeguards keep at least one admin and stop you acting on your own
row. There is **no open sign-up** — every account comes from the owner or an admin invite — and
**admins never see another user's nutrition or weight data**, only account metadata.

### Compte / À propos

Manage credentials and your metabolic profile (sex, birthdate, height); view the app version and
live server diagnostics (Node.js, uptime, OS, CPU, memory, database size).

### Setup & login

On a fresh install a **first-run setup wizard** creates the owner (admin) account. After that,
new accounts come only from an **admin invite link** — a one-time, 7-day link that opens the same
wizard — so there is **no public sign-up**. Login is rate-limited with lockout backoff and keeps
you signed in across restarts; password recovery is an **admin-generated reset link**, not a
self-service "forgot password".

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
- **Multi-user self-hosting** — an admin owner plus isolated invited accounts, no public
  sign-up; you front it with your own reverse proxy / TLS.

---

## Install as an app (phone & desktop)

Macronome's UI is **responsive**, and it's an installable **PWA**: on a phone or a computer it
launches in its own window (no browser bar), with the OS status bar / title bar following the
in-app light/dark theme. New versions install silently and apply on the next launch.

**On your phone:**

- **Android / Chrome (Chromium):** open the app, then tap the **Install app** button in
  **Settings → Update**, or use the browser menu's **"Add to Home screen / Install app"**.
- **iPhone / iPad (Safari):** open the app, tap **Share**, then **"Add to Home Screen"**.

Once installed it runs like a native app. Two mobile extras: snap a **dish photo** for AI macro
estimation, and light **haptic feedback** on key actions.

![Macronome on mobile](docs/img/preview_mobile.png)

**On your computer (Chrome / Edge):** open the app and click the **Install** icon in the address
bar, or the browser menu → **"Install Macronome"**. It opens as a standalone desktop window with a
native **right-click menu** and app **shortcuts** for quick navigation.

![Macronome installed on the desktop](docs/img/preview_pc.png)

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
`COOKIE_SECURE=true` — the default `TRUSTED_PROXY` already trusts a same-host or
Docker-sidecar proxy, so no extra setup is needed (narrow `TRUSTED_PROXY` to tighten).

**Backups.** The only critical state is the `pgdata` volume — back it up (e.g. `pg_dump`) before
upgrades. At the data level, Macronome also offers an in-app **JSON export/import** and an optional
**automatic Google Drive backup** (both in Settings) — convenient, but not a substitute for a
volume/database backup.

### Configuration (all optional — defaults shown)

Copy [`.env.example`](.env.example) to `.env` and uncomment only what you want to override.

| Variable            | Default                 | Purpose                                                                                                     |
| ------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `MACRONOME_TAG`     | `latest`                | Image tag to deploy (`latest` or `vX.Y.Z`).                                                                 |
| `APP_PORT`          | `3000`                  | Host port mapped to the app.                                                                                |
| `POSTGRES_DB`       | `macronome`             | Database name.                                                                                              |
| `POSTGRES_USER`     | `macronome`             | Database user.                                                                                              |
| `POSTGRES_PASSWORD` | `macronome`             | Database password (Postgres is internal-only, not exposed).                                                 |
| `SESSION_SECRET`    | _(auto-generated)_      | Cookie signing key; generated & persisted on first boot if unset.                                           |
| `COOKIE_SECURE`     | `false`                 | Mark session cookies `Secure` (safe behind an HTTPS proxy).                                                 |
| `TRUSTED_PROXY`     | `loopback, uniquelocal` | Peers trusted for `X-Forwarded-*` (real client IP + Secure cookies); default covers a Docker sidecar proxy. |

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
