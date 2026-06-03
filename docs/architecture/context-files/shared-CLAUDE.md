# CLAUDE.md — packages/shared

Types + constants ONLY. **No runtime/business logic** (logic is the backend's).

Imported by `api` (to compute) and `web` (to display/validate), so anything here is
a single source of truth that cannot drift between client and server.

## Contents
- `constants/energy.ts` — KCAL_PER_G {fat:9, carb:4, protein:4}; KCAL_PER_KG 7700.
- `constants/activity.ts` — the five canonical levels: key, multiplier (1.2…1.9),
  i18n label/description keys. These exact labels are used everywhere.
- `constants/rating.ts` — null=unrated, 0=Bof,1=Moyen,2=Ok,3=Top; helpers
  (a `rating≥1` filter excludes BOTH Bof and unrated).
- `constants/tuning.ts` — EMA_ALPHA=0.35, BEST_MONTH_MIN_DAYS=5, NOK_RUN_ALERT=3,
  SUGGEST_HALF_WIDTH=50. Named constants, tunable in one place.
- `dto/*` — one Zod schema module per API resource; types are inferred from them.
  Controllers validate with these; the web client types requests/responses with them.
- `errors.ts` — the ErrorCode enum mirroring `spec/api/00-conventions.md`.

## Rules
- If you write a function that *calculates* a nutrition/weight/stats figure here,
  it's in the wrong package — move it to `api/src/domain`.
- Keep DTOs aligned with `spec/api/*`. When in doubt, the spec wins.
