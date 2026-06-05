# Logic spec — shared conventions

Applies to every file under `spec/logic/`. Carries the v2.2 reconciled
conventions verbatim. Read this first; the other logic files assume it.

## Units

- Mass: grams (g) internally everywhere. The UI may show kg; storage and
  computation are in g unless a field is explicitly `_kg`.
- Energy: kilocalories (kcal).
- Macros: grams (g). Macro densities: **fat 9, carb 4, protein 4 kcal/g**.
- Weight (body): kilograms (kg). Height: centimetres (cm). Waist: cm.
- Energy per kg of body mass: **7700 kcal/kg**.
- SI/metric only. Never imperial.

## Rounding (display vs storage)

- **Store full precision** (no rounding at write time) for all derived numbers
  unless a field is defined as an integer input.
- **Display rounding** is applied only at render:
  - kcal: integer (round half-up).
  - macro grams — consumed/aggregate amounts (meal & day totals, journal) and
    target floors/ceilings: integer (round half-up).
  - macro grams — per-100 g food/recipe composition and per-portion recipe
    macros: 1 decimal.
  - body weight, trajectory, EMA: 1 decimal (kg).
  - BMI: 1 decimal.
  - g/kg ratios: 2 decimals.
  - rates (kg/week): 2 decimals.
- Worked examples below state expected values at display precision; the
  unit-test oracle should compare at display precision unless noted "exact".

## Sign conventions (RECONCILIATION_LOG §B)

- **deficit = intake − burn.** A real deficit is **negative**; a surplus is
  **positive**. Used everywhere (Repas constat, Cibles, Weight period table).
- The burn term in `deficit` is the **estimated** burn (BMR × activity), not the
  empirical burn — see `metabolic-engine.md`.
- `lost_kg` is **positive when weight decreased** over the span
  (`lost_kg = weight_start − weight_end`); negative if weight rose.
- `kg/week` equivalent of a daily deficit: `deficit_per_day / 7700 × 7`
  (negative deficit → negative kg/week → weight loss).

## Rating scale (RECONCILIATION_LOG §C1)

`null` = **unrated** (default, rendered as "—", no star widget) ·
`0` = Bof · `1` = Moyen · `2` = Ok · `3` = Top.
`0` is a real grade, distinct from unrated. A "rating ≥ 1" filter excludes
**both** Bof (0) and unrated.

## Activity levels (RECONCILIATION_LOG §D2) — five canonical

| key               | FR label          | EN label          | multiplier |
| ----------------- | ----------------- | ----------------- | ---------- |
| sedentary         | Sédentaire        | Sedentary         | 1.20       |
| lightly_active    | Faiblement actif  | Lightly active    | 1.375      |
| moderately_active | Modérément actif  | Moderately active | 1.55       |
| very_active       | Très actif        | Very active       | 1.725      |
| extremely_active  | Extrêmement actif | Extremely active  | 1.90       |

## Logical day & "as of"

- One `DayLog` per calendar date per user.
- "As of the latest logged day" = the most recent date that has a `DayLog`
  carrying a calorie value (detailed Σ entries, or summary `summary_kcal`).

## Effective verdict

For any day, **effective verdict = manual override if set, else the auto value**.
Stats, streaks and OK-rate always use the effective verdict.

## Oracles, real-value validation & provenance (sync model)

- The worked examples in `spec/logic/*` are **neutral CI oracles**: mathematically
  valid, no personal data (canonical profile 80 kg / 180 cm / 40 / male → BMR 1730).
  They are wired as the synced `*.test.ts` cases (see `docs/architecture/testing.md`).
- **Real-value validation** (the author's actual numbers) and **migration against the
  real workbook** are exercised only by **local-only** `*.local.test.ts` suites, which
  `.gitignore` excludes. Their data lives in the git-ignored corpus
  (`specifications/tests-local/`, `specifications/suivi_poids.xlsx`). Never copy a real
  value into a synced oracle or into this `spec/`.
- **Provenance citations** in these files (e.g. "RECONCILIATION_LOG §B2", "OPEN_GAPS
  #9") point to `specifications/RECONCILIATION_LOG.md` / `specifications/OPEN_GAPS.md`,
  which are **git-ignored** (local authority, present in the working copy, absent from
  a fresh clone). Each contract statement here is self-contained; the citation is a
  back-reference, not a dependency.
