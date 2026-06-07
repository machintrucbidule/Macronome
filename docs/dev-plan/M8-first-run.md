# M8 — First-run & usability

**Goal:** the application is **usable on a fresh install with no data**. On first launch
(when no account exists) a setup wizard creates the single owner account; the login form
actually works; and every screen is navigable/usable with zero data, which the user then
fills in manually. This is what makes the app genuinely usable **after M9 (the end of the
dev plan), without any Excel migration** (the Excel import is out of the dev plan — it is
done through the in-app Settings → import, the IMP-1 envelope).

Depends-on: M0 (auth/session skeleton), M1–M7 (the screens that must render empty).

## Scope

### 1. First-run setup wizard (creates the single owner account)

- **New bootstrap endpoint** — `POST /api/v1/auth/setup`, active **only when
  `count(app_user) == 0`**. It creates the owner account (username, password + the
  profile fields the metabolic engine needs: `sex`, `birthdate`, `height_cm`, same as
  the `create-user` script) and seeds defaults via the existing
  `seedDefaultsForUser` (`packages/api/src/services/user-bootstrap.ts`) — default meal
  template + locked built-in "Rien". On success it establishes the session (the user is
  logged in). Once a user exists it returns **403/409 `setup_already_completed`** and
  creates nothing. CSRF protection still applies.
- **Setup-state probe** — a `GET` the web uses to decide whether to show the wizard
  (e.g. `GET /api/v1/auth/setup-state` → `{setup_required: boolean}`, **unauthenticated,
  non-enumerating** — it only says whether _any_ user exists, never _which_).
- **Web wizard** — `features/setup/`: a gated screen shown when `setup_required`,
  collecting credentials + the required profile, then logging in and routing to home.
- **`create-user` CLI kept as an admin fallback** (`packages/api/scripts/create-user.ts`,
  unchanged) for headless / recovery bootstrap.

> **Gating rationale:** this is a one-shot, zero-user-gated bootstrap, **not** open
> public registration. It is disabled the instant the owner exists. The contract is
> amended accordingly (see "Contract work" below).

### 2. Core login wiring (moved here from M9)

- Wire `packages/web/src/features/login/LoginPage.tsx`: submission →
  `POST /api/v1/auth/login` → session cookie → redirect to the home route; surface the
  generic `invalid_credentials` failure. (The richer **polish** — lockout countdown,
  detailed error/empty states, a11y — stays in **M9**.)

### 3. Empty-data usability pass

- Verify every screen (Repas, Journal, Poids, Aliments, Recettes, Cibles, Stats,
  Paramètres, Contenants, Compte) is navigable and usable immediately after first login
  with **zero data**, and that the user can create their first food / target / weigh-in /
  meal entry from there. This is a "no crash / usable / can add data" pass — **not** the
  full Empty/Skeleton/error visual contract, which remains M9.

## Contract work (author-authorized amendment)

The fixed contract `spec/api/00-conventions.md` previously said "No public sign-up in
v1." The author **explicitly authorized** amending it to permit the gated first-run
wizard. M8 makes these doc changes (no behaviour beyond the wizard above):

- `spec/api/00-conventions.md`: reword the sign-up line to a bounded allowance (no open
  registration; a one-shot zero-user-gated setup creates the single owner, then
  disabled) and add `POST /api/v1/auth/setup` (+ the setup-state probe) to the auth list.
- `docs/architecture/security.md` §1 and `docs/architecture/ops.md` §7: describe the
  first-run wizard (primary) + `create-user` CLI (fallback).
- `DECISIONS.md`: an entry recording the decision and the authorized amendment.

## Files (via `module-map.md`)

- **api:** `src/http/routes/auth.ts` (+ `setup`, `setup-state`),
  `src/http/controllers/auth.ts` (+ handlers), a setup service reusing
  `services/user-bootstrap.ts`; `packages/shared/src/dto/auth.ts` (a `SetupSchema`).
- **web:** `src/features/login/LoginPage.tsx` (wire submit), new `src/features/setup/`
  (wizard, decomposed per `modularity.md`), a router guard that redirects to the wizard
  when `setup_required`.
- **tests:** `packages/api/test/integration/auth.test.ts` (setup when DB empty →
  200 + session; setup when a user exists → 409 `setup_already_completed`; login wiring),
  e2e `e2e/setup.spec.ts` (fresh DB → wizard → create account → land logged-in →
  navigate empty screens).

## Acceptance criteria

- **Integration:** `POST /auth/setup` on an empty DB creates the owner + seeds defaults +
  sets the session; on a non-empty DB → 409 `setup_already_completed` (nothing created);
  the setup-state probe is non-enumerating; login submission authenticates and returns
  the user.
- **e2e:** fresh DB → wizard creates the account → user lands logged-in → every screen
  renders and is usable with no data; can add a first food/entry.
- **Docs:** the spec amendment + `DECISIONS.md` entry are in place; no contradictory
  "no public sign-up" / "ETL bootstraps the first user" statements remain.
- typecheck + lint + `check:schema` green.

## Size check

Wizard decomposed per `modularity.md` §2 (frame + step components + a hook); no file
approaches 300 lines. The setup service is thin (reuses `user-bootstrap`).

## Checklist

- [x] `POST /auth/setup` (gated to zero users) + seeds defaults + opens session
- [x] setup-state probe (non-enumerating) driving the web guard
- [x] `features/setup/` wizard (credentials + required profile) → logged-in → home
- [x] `create-user` CLI confirmed still working as fallback (unchanged; same
      `appUser.create` + `seedDefaultsForUser` path the setup service reuses; typecheck green)
- [x] login form submission wired (LoginPage) → session → redirect
- [x] empty-data usability pass across all screens (can add first data)
- [x] contract amended (`spec/api/00-conventions.md`) + security.md/ops.md updated + DECISIONS entry
      — **already in place** from the dev-plan restructuring commit; verified consistent, no
      re-edit needed (no leftover "no public sign-up" / "ETL bootstraps the first user").
- [x] acceptance: setup/login integration + first-run e2e green; typecheck + lint + check:schema green

## Deviations / deferred (tracked)

- **Router guard scope = setup-only** (author-approved). `AppGate` only forces the wizard
  while no owner exists, and sends `/setup` visitors home once one exists. **Full
  unauthenticated route protection** (a session-aware `RequireAuth` redirecting logged-out
  users on data screens to `/login`) is **deferred to M9** — M8 wires login submission but
  does not lock down the data routes yet.
- **Login polish** (lockout countdown, detailed error/empty states, a11y) → **M9** (as
  originally scoped). M8 surfaces a single generic `invalid_credentials` flag only.
- **Full Empty/Skeleton/error visual contract** across screens → **M9**. M8's usability
  pass is "no crash / usable / can add first data" (e2e navigates empty screens + adds a
  first food); it is not the full visual-state contract.
- **Wizard is two steps** (credentials → profile), author-approved.
- **e2e isolation:** the first-run spec needs a zero-user DB, so `playwright.config.ts`
  runs it alone in a `first-run` project that the `app` project depends on (serial phase
  before the rest, which each seed their own user). No new error code beyond the
  contract's `setup_already_completed`.
