# M9 — Polish

**Goal:** close the gap between "feature works" and "daily-use ready" — remaining
screen states, i18n completeness, accessibility, and perf on real-sized data.
Depends-on: M1–M7.

## Scope

- **States** (`design/components/states.md`): every screen has Empty / Skeleton /
  error states; login error + lockout; disabled wrappers. No raw spinners where a
  skeleton is specified.
- **i18n completeness:** FR + EN keys for every string; numbers/dates via `Intl.*`
  (not i18next); FR⇄EN text-expansion checked per `design/theming.md`. Server returns
  error **codes**; the client maps to strings.
- **Theming:** dark default + light via `data-theme`; only semantic tokens (no raw
  hex), `--tap` 40/44px responsive override.
- **Accessibility:** keyboard nav (the Repas serpentine Tab/arrow nav, cook-mode
  numpad/AZ keyboard), focus ring, modal focus trap, labelled inputs.
- **Perf:** autocomplete and Stats over years of data stay responsive (indexes from
  `spec/schema/indexes.md`); list virtualization only if measured necessary.

## Acceptance criteria

- Every screen renders its empty/loading/error states (component tests where logic is
  tricky — keyboard nav, font autosize — per `testing.md` §6, otherwise e2e smoke).
- No untranslated keys (a lint/CI check or a key-coverage test); no raw hex in `web`
  styles (lint).
- e2e a11y smoke on the critical flows; a perf check on Stats + Foods search with a
  large seed.

## Size check

Polish touches many files but adds no large ones; state components live under
`components/states/` and feature-local `states`.

## Split into sub-passes (approved)

M9 is too large for one safe pass, so it is built in sub-passes (DEV_PLAN allows this).

- **M9a — States, login & i18n — DONE.** Login state card; locale-aware numbers (Intl);
  i18n key-coverage CI gate. See §"M9a delivered / deviations" below.
- **M9b — A11y & layout** (next): focus trap / focus ring / labelled inputs / keyboard nav;
  sticky appbar + `thead` offset + `.tblscroll` (M1 carried); `RequireAuth` → `/login`.
- **M9c — Cook mode** (carried from M3, below).
- **M9d — Perf**: large-seed checks on Stats + Foods search; indexes verified.

## Checklist

- [~] all screen states (empty/skeleton/error) per design/components/states.md
  _M9a: full login card (idle/loading/error/lockout/success); Foods load-error banner
  added (Repas already had one). Per-screen Empty/Skeleton were already in place from
  earlier milestones. Remaining visual-contract polish + a11y states → M9b._
- [x] i18n FR/EN complete; Intl number/date — _M9a: `check:i18n` CI gate locks FR/EN parity;
      numbers localised via `lib/format/number` (Intl). FR⇄EN text-expansion visual pass → M9b._
- [ ] theming/tokens audit (no raw hex; --tap) — _audit: no raw hex outside `tokens.css`
      (verified M9a); `--tap` responsive override → M9b._
- [ ] keyboard nav + focus management + modal focus trap → M9b
- [ ] perf check on large data; indexes verified → M9d
- acceptance: state/i18n/a11y checks green; critical-flow e2e still green
  _M9a acceptance green: `number.test.ts` (FR comma / EN dot / half-up) + `check:i18n` +
  typecheck + lint + web build; `e2e/login.spec.ts` (bad-creds banner, lockout countdown)._

## M9a delivered / deviations

- **Login state card** (`features/login/`): `useLogin` is now a server-driven state machine
  (idle/loading/error/lockout/success) with a live lockout countdown; `LoginPage` renders the
  full contracted card (banner `err-creds`, `err-lock` countdown with submit hidden + fields
  disabled, success flash, `stay_signed_in`, FR/EN + theme top-bar). `ApiError` now carries
  `retryAfterS`. **No backend change**: the lockout (`rateLimit.ts` → 429 `locked_out`) and
  `TRUSTED_PROXY` were already implemented + tested in the API; M9a only renders them.
- **Numbers** (`lib/format/number.ts`): single Intl-based source; per-feature `format.ts`
  (foods, weight, targets) + `VerdictCluster` delegate to it. **Grouping is OFF** on purpose
  (dense tabular tables; the FR group separator is a narrow NBSP — a test/copy hazard), so
  integers stay locale-independent and only the decimal mark localises (FR "," / EN "."). The
  `cibles` e2e assertion `-40.0` → `-40,0` accordingly. Meals/journal/stats integer helpers
  are unchanged (no decimals → nothing to localise).
- **i18n gate**: `scripts/check-i18n.mjs` + root `check:i18n` + a CI step beside `check:schema`.
- **Already-done found during audit**: full primary nav + account menu (shipped M7/M8) covers
  the M1-carried "Full primary nav" item; no raw hex outside `tokens.css`.

### Carried over from M3 (deferred here, tracked)

- [ ] **Cook mode (CookModeModal)** — the near-fullscreen, keyboard-free kitchen-tablet
      adjustment UI for Repas (`specifications/screens/meals.md` §Cook mode). Decompose per
      `modularity.md` §2: `features/meals/modals/CookModeModal/` = `CookModeModal.tsx`
      (frame) · `CookRow.tsx` · `NumPad.tsx` · `AzKeyboard.tsx` · `useCookSession.ts`
      (working-copy state) · `useFontAutosize.ts`. Reuses the meal-screen food-search + unit
      menu; edits are in-memory until Valider. (Deferred from M3 to keep M3b's blast radius
      small; the core daily log + leftover + custom ship in M3b.)

### Carried over from M1 (finish the visual contract)

- [ ] **Sticky app bar + table-header offset:** make the AppShell appbar sticky so the
      dense-table `thead` `top: var(--appbar-h)` offset is correct; add the horizontal-scroll
      table variant (`design/components/data-tables.md` `.tblscroll`) without re-introducing
      the sticky-offset overlap (M1 removed `.wrap` overflow to avoid it).
- [x] **Full primary nav + account menu** (`design/components/top-nav.md`): shipped in M7/M8
      — `AppShell` has all six tabs + the `AccountMenu` (Cibles/Contenants/Paramètres/Compte).
- [x] **Locale-aware number formatting** (Intl) — M9a: `lib/format/number.ts` localises the
      decimal mark in the foods table/modals and elsewhere (grouping off; see M9a deviations).
