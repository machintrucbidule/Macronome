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
- **M9b — A11y & layout — DONE.** focus trap / focus ring / labelled inputs / keyboard-operable
  sort headers; sticky appbar + `thead` offset + `.tblscroll` (M1 carried); `RequireAuth` →
  `/login` + global 401 handler. See §"M9b delivered / deviations" below.
- **M9c — Cook mode — DONE.** Near-fullscreen, keyboard-free kitchen-tablet adjustment modal for
  Repas. See §"M9c delivered / deviations" below.
- **M9d — Perf**: large-seed checks on Stats + Foods search; indexes verified.

## Checklist

- [x] all screen states (empty/skeleton/error) per design/components/states.md
      _M9a: full login card (idle/loading/error/lockout/success); Foods load-error banner
      added (Repas already had one). Per-screen Empty/Skeleton were already in place from
      earlier milestones. M9b: a11y states — modal focus trap + focus ring + labelled inputs._
- [x] i18n FR/EN complete; Intl number/date — _M9a: `check:i18n` CI gate locks FR/EN parity;
      numbers localised via `lib/format/number` (Intl)._
- [x] theming/tokens audit (no raw hex; --tap) — _no raw hex outside `tokens.css`
      (verified M9a); `--tap` responsive override already shipped in `tokens.css` (40px →
      44px ≤760px) — verified present in M9b, no change needed._
- [x] keyboard nav + focus management + modal focus trap — _M9b: `useFocusTrap` (focus-on-open,
      Tab trap, restore) + `aria-labelledby` on `Modal`; global `:focus-visible` ring; keyboard-
      operable `SortableTh`. Repas serpentine nav already shipped (M3)._
- [ ] perf check on large data; indexes verified → M9d
- acceptance: state/i18n/a11y checks green; critical-flow e2e still green
  _M9a acceptance green: `number.test.ts` (FR comma / EN dot / half-up) + `check:i18n` +
  typecheck + lint + web build; `e2e/login.spec.ts` (bad-creds banner, lockout countdown)._
  _M9b acceptance green: typecheck + lint (0 errors) + `check:i18n` + web build + unit (65) +
  full e2e (18, incl. the new RequireAuth redirect test in `e2e/login.spec.ts`)._

## M9c delivered / deviations

- **CookModeModal** (`features/meals/modals/CookModeModal/`): the 🍳 button in each `MealHeader`
  (previously disabled, `meals.cookSoon`) now opens a near-fullscreen modal — large-type meal lines
  on the left (font auto-sized to fill the height, no scroll), a numeric keypad on the right
  (greyed until a quantity is tapped). Tapping a unit opens the shared `UnitMenu`; tapping a
  referenced food name swaps the keypad for a virtual A–Z keyboard + a results list and a pick sets
  the food. **Valider** writes back; **Annuler** discards.
- **Working copy + batched write-back**: `useCookSession` holds an in-memory clone of the meal's
  entries; `apply()` (pure `logic/cookDiff.ts`) diffs vs the originals and yields one entry patch
  per changed referenced line (only the changed fields). The controller's new
  `actions.applyCookEdits(mealId, edits)` loops the **existing** `updateEntry` mutation inside the
  shared `run` error wrapper. **Web-only — no backend, schema, or contract change.**
- **Reuse**: meal-screen food search (`useFoodSearch`), the `FoodLine` `UnitMenu`, and the shared
  `Modal`'s `useFocusTrap` (cook mode uses its own fullscreen frame, not the centered `Modal`
  shell, but reuses the focus-trap + Escape-close behaviour).
- **Decomposition** (modularity §2): the modal is split into frame + `CookList` + `CookRow` +
  `CookNameCell` + `CookUnitCell` + `CookPad` + `NumPad` + `AzKeyboard`, plus the `useCookSession`
  /`useFontAutosize` hooks and `logic/{fontAutosize,cookDiff}` pure helpers — every file warning-
  free under the 80-line/complexity soft limits and far under the 300-line cap.
- **Deviation (UI)**: the food-search results render as a list **in the pad** (above the A–Z
  keyboard) rather than as a floating dropdown anchored under the row input (mockup `.cook-ac`).
  Same intent ("pick a result sets the food"), more robust on a shared tablet, no fixed
  positioning. Custom lines are read-only here (weight managed in the custom editor), per spec.
- **Acceptance green**: typecheck + lint (0 errors) + `check:i18n` (462 keys) + web build + unit
  (71, incl. `fontAutosize.test.ts` clamp oracle + `cookDiff.test.ts`) + e2e `meals.spec.ts` (5,
  incl. the new cook-mode qty write-back: open 🍳 → tap qty → keypad 100 → Valider → 200 kcal).

## M9b delivered / deviations

- **Sticky appbar** (`AppShell.module.css`): `.appbar` is now `position:sticky; top:0;
z-index:var(--z-appbar)`, so the dense tables' `thead { top:var(--appbar-h) }` offset finally
  lines up on scroll. Nav got an `aria-label` (NavLink already emits `aria-current="page"`).
- **`.tblscroll`** (`DataTable.module.css` + Poids `weight.module.css`): the long-table variant
  (`max-height:420px; overflow:auto`) with the header sticky to the **box** top (`top:0`, since
  inside an overflow box the offset resolves against the box, not the viewport). Applied to the
  Poids period table — the contract's named use case.
- **Focus ring** (`global.css`): one zero-specificity `:where(...):focus-visible` baseline ring
  (`--focus`, 22% mix) for links/nav/menu items/`role=button`; component rules (buttons, inputs'
  border-color) still win. `SortableTh` is now a `<button>` inside the `th` → keyboard-operable
  (Enter/Space) with its own focus ring; `aria-sort` preserved.
- **Modal a11y** (`Modal.tsx` + new `useFocusTrap.ts`): focus moves into the panel on open, Tab/
  Shift+Tab is trapped, focus is restored to the trigger on close; `aria-labelledby` wires the
  header (`useId`). No API change to the 7 feature modals.
- **Labelled inputs**: `Autocomplete` input is a `role=combobox` with `aria-label` +
  `aria-controls`/`aria-activedescendant` over a `role=listbox`/`option` list; the Custom-food and
  Leftover modal fields got `htmlFor`/`id` (their `<label>`/control were previously unassociated).
- **RequireAuth** (`RequireAuth.tsx` + `router.tsx`): every app route is wrapped, including the
  `/health` diagnostic UI; logged-out → `/login` (via `useSession`, 401 not retried). Only
  `/login` and `/setup` are public. The underlying `GET /api/v1/health` readiness endpoint stays
  public (Docker/CI probe) but returns no user data — only the UI page is gated. The M0 health
  smoke (`e2e/health.spec.ts`) now seeds an owner and logs in before visiting `/health`.
- **Global 401 → /login** (`api/client.ts`): a 401 on a non-`/auth/*` call while on a protected
  page hard-redirects to `/login` (session expired mid-use). It **skips** `/auth/*` (their 401s
  are normal) and the public pages (`/login`, `/setup`), so `SettingsSync`'s logged-out
  `/settings` probe stays silent per its contract.

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

- [x] **Cook mode (CookModeModal)** — DONE in M9c. The near-fullscreen, keyboard-free kitchen-
      tablet adjustment UI for Repas (`specifications/screens/meals.md` §Cook mode). Decomposed per
      `modularity.md` §2 under `features/meals/modals/CookModeModal/`: `CookModeModal.tsx` (frame) ·
      `CookList.tsx` · `CookRow.tsx` · `CookNameCell.tsx` · `CookUnitCell.tsx` · `CookPad.tsx` ·
      `NumPad.tsx` · `AzKeyboard.tsx` · `useCookSession.ts` (working copy) · `useFontAutosize.ts` ·
      `cook-mode.module.css`. Reuses the meal-screen food search (`useFoodSearch`) + the shared
      `UnitMenu` + `useFocusTrap`; edits are in-memory until Valider. See §"M9c delivered" below.

### Carried over from M1 (finish the visual contract)

- [x] **Sticky app bar + table-header offset:** DONE in M9b — the AppShell appbar is sticky so
      the dense-table `thead top:var(--appbar-h)` offset is correct; the `.tblscroll` scroll
      variant (`design/components/data-tables.md`) ships for the Poids period table without
      re-introducing the sticky-offset overlap. See §"M9b delivered / deviations".
- [x] **Full primary nav + account menu** (`design/components/top-nav.md`): shipped in M7/M8
      — `AppShell` has all six tabs + the `AccountMenu` (Cibles/Contenants/Paramètres/Compte).
- [x] **Locale-aware number formatting** (Intl) — M9a: `lib/format/number.ts` localises the
      decimal mark in the foods table/modals and elsewhere (grouping off; see M9a deviations).
