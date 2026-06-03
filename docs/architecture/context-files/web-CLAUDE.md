# CLAUDE.md — packages/web

React + Vite SPA. **Renders, never computes.** A thin client of `/api/v1`.

## Structure
- `features/<screen>/` — one per screen (see module-map). Page container + local
  `components/` + `hooks/` + optional `modals/` + `logic/` (VIEW logic only).
- `components/<Component>/` — design-system components, one per `design/components/*`.
- `api/<resource>.ts` — typed client per API resource; `api/client.ts` handles
  cookies, the CSRF header, and the error envelope.
- `styles/tokens.css` — COPIED VERBATIM from `design/tokens.css`. Do not edit it;
  consume semantic tokens (`var(--bg)`, `--accent`, `--ok`…), never raw hex.
- `i18n/` — i18next + `locales/fr.json|en.json`. Number/date formatting uses
  `Intl.NumberFormat`/`Intl.DateTimeFormat` (decimal comma in FR), not i18next.

## Hard rules
- No domain calculation here. Calorie totals, OK/NOK, proration preview, burns, EMA,
  BMI, trajectory, stats — all come from the API. If you're about to multiply macros
  by grams in `web`, stop and call the endpoint.
- `shared` constants are imported only for labels/formatting (e.g. show the activity
  multiplier beside its name), never to derive a nutrition number.
- 300-line file cap. Decompose large screens and complex modals (Leftover, CustomFood,
  CookMode) into sub-components — see docs/architecture/modularity.md for the meals tree.
- Theme = `data-theme` on `<html>`; charts must reference themed series tokens
  (`--trend` flips dark↔light) or lines vanish on light.

## Server state
- TanStack Query for fetching/mutations/invalidation; keep feature hooks thin.

## Tests
- Component tests (Vitest + RTL) only where local logic is tricky (keyboard nav,
  font autosize). The critical-flow coverage is the Playwright e2e suite at repo root.
