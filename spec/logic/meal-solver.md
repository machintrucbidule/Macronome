# Logic spec — meal solver, the accountant + verifier (`meal_suggestions`)

The deterministic half of the AI meal-suggestions hybrid (B-123). The **chef**
(`ai-meal-suggestions.md`) picks foods qualitatively and outputs **no quantities**; this file is
the **accountant** (sets integer portion counts / 5 g-step grams to minimise a penalty over the
day's targets) and the **verifier** (recomputes the day total in code and certifies the fit). The
"fits the targets" claim is **never trusted from the LLM** — it is always recomputed here.

All functions are **pure and deterministic** (same inputs → same output) and are the
correctness backbone, asserted by the worked oracles in §6 (the synced neutral CI oracles per
`00-conventions.md`). Tuning weights/limits live in `packages/shared/src/constants/tuning.ts`.

## 1. Remaining-to-target (pure)

From `GET /days/:date` (`days-meals-leftover.md`): `target_snapshot {cal_min, cal_max,
protein_floor_g, fat_floor_g, carb_ceiling_g}` and `totals {kcal, fat, carb, protein}` (the
day-wide aggregate of everything already entered). Define:

```
rem_cal_min  = cal_min − totals.kcal          // may be ≤ 0 if already at/over cal_min
rem_cal_max  = cal_max − totals.kcal
need_protein = max(0, protein_floor_g − totals.protein)
need_fat     = max(0, fat_floor_g     − totals.fat)
carb_room    = carb_ceiling_g − totals.carb   // soft
```

- **Null floors / ceiling.** Per `targets-macros.md`, the floors require a current weight and a
  Target. If `protein_floor_g`/`fat_floor_g`/`carb_ceiling_g` is null, **that constraint is
  dropped** (treated as satisfied). The proposal still runs against whatever remains (at minimum
  the calorie band, always present once a Target exists).
- **No target at all.** If `cal_min`/`cal_max` are absent (no Target), there is nothing to aim at:
  the endpoint returns `422 validation_error` with `details: { reason: "no_target" }` (the
  `no_target` signal). Documented in `spec/api/ai.md`.
- **Already over.** If `rem_cal_max < 0` (the day is already above `cal_max`), the only feasible
  proposal is the empty set; the solver adds nothing and surfaces a `calorie` gap (`delta_kcal` =
  the existing overshoot). The UI shows "déjà au-dessus de la cible".

## 2. The solver (pure, deterministic)

**Critical correctness rule — calorie-axis basis.** Each food's calorie contribution is computed
from its stored `kcal_per_100g`, **not** from `9·fat + 4·carb + 4·protein`. Reason: the app
snapshots and sums `kcal_per_100g` at entry-write time (`POST /meals/:id/entries`), and a food's
stored kcal need not equal its macro arithmetic (manual entries, label rounding, recipes). Using
the same basis guarantees the **verified day total equals what the app will actually store** after
apply. Macro axes (P/L/G) use the food's per-100 g macros likewise. (`00-conventions.md` densities
9/4/4 are still used for the _derivation_ of `carb_ceiling_g` upstream, not here.)

**Decision variables** — one per LLM-picked food line (each already assigned to a selected meal):

| Food kind                                   | Variable          | Domain                                                                                                      |
| ------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| has named portions (LLM chose `portion_id`) | integer count `n` | `0 ≤ n ≤ MAX_PORTION_COUNT` — **indivisible**, whole portions only; grams `= n × portion.grams`             |
| no named portions                           | grams `g`         | `g ∈ {0, 5, 10, …}` — **5 g steps** (`PORTIONLESS_GRAM_STEP`), to a per-food cap derived from `rem_cal_max` |

**Per-food contribution** at grams `g`: `kcal = kcal_per_100g · g / 100`; `fat = fat_per_100g · g
/ 100`; likewise carb, protein.

**Day aggregates** for a candidate quantity vector `q`:
`dayKcal = totals.kcal + Σ kcal_i(q)`, similarly `dayP, dayL, dayG`.

**Constraints (D2):** hard — `cal_min ≤ dayKcal ≤ cal_max`, `dayP ≥ protein_floor_g`,
`dayL ≥ fat_floor_g`; soft — `dayG ≤ carb_ceiling_g`.

**Objective — minimise the penalty `P(q)`** (weights = `SOLVER_PENALTY` in `tuning.ts`):

```
over  = max(0, dayKcal − cal_max)        under = max(0, cal_min − dayKcal)
shP   = max(0, protein_floor_g − dayP)   shL   = max(0, fat_floor_g − dayL)
exG   = max(0, dayG − carb_ceiling_g)
P(q)  = 1.5·over  +  1.0·under  +  8·shP  +  8·shL  +  0.5·exG  +  0.05·(Σ carb_i(q))
```

- `P(q) = 0` ⇔ **full fit** (all hard satisfied, under the ceiling).
- `P(q) > 0` ⇒ **closest fit**; the nonzero terms become the user-facing `gaps` (§3).
- **Asymmetry encodes D2 + D3.** Calorie-**over** (1.5/kcal) is penalised more than calorie-**under**
  (1.0/kcal) — a deficit tracker must not overshoot to satisfy a macro (D3). Floor shortfalls are
  weighted high (8/g) so the solver never trades a genuine floor miss for a few kcal of comfort.
  The carb ceiling is soft (0.5/g). The final `0.05·carb` term is a **deterministic tie-break**
  that prefers the lower-carb remainder among otherwise-equal feasible solutions; it can never
  block feasibility (1 g of carb adds 4 kcal, worth up to 4.0 in `under` reduction — 80× its own
  0.05 cost). **There is no midpoint or low-calorie bias term**, so among full fits the day total
  may land anywhere in `[cal_min, cal_max]`.

**Method & determinism.** The solver:

1. Enumerates exhaustively when the Cartesian product ≤ `SOLVER_ENUM_BUDGET` combinations,
   returning the global `argmin P`.
2. Otherwise runs deterministic **coordinate descent** from a proportional-scaling seed (scale each
   food so the set's raw kcal ≈ midpoint of the remaining band), iterating to a local `argmin P`.

`temperature: 0` on the LLM (provider default, `ai-connection.md`) + a pure solver ⇒ same inputs
yield the same output.

## 3. Feasibility, fit, and gaps

- **Full fit** (`P = 0`): `fit = "full"`, `gaps = []`.
- **Closest fit** (`P > 0`): `fit = "closest"`; `gaps` lists each residual:
  - protein/fat floor short by `g`: `{ "target": "protein_floor" | "fat_floor", "short_g": g }`
    (rounded to integer grams for display).
  - calorie band miss: `{ "target": "calorie", "delta_kcal": d }` where `d = dayKcal − cal_max`
    (positive, over) or `dayKcal − cal_min` (negative, under).
  - carb over the ceiling is **not** reported as a gap (soft); it is penalised so the solver avoids
    it when it can. When unavoidable it is shown informationally (`G nnn · au-dessus du plafond`),
    not as a hard gap.
- The system **never silently claims success**: a closest fit is always labelled and quantified.
  No internal rationale (penalty weights, "conservative bias") is shown to the user — only
  user-meaningful text, e.g. _"Au plus proche — il manque 3 g de lipides pour le plancher."_

## 4. The verifier (pure)

Whatever quantities the solver returns, the verifier **recomputes** `dayKcal/dayP/dayL/dayG` from
the quantities (using the calorie-axis basis of §2), then derives `day_total` (display-rounded:
kcal integer, aggregate macro grams integer per `00-conventions.md`), `targets_met`
(`{calorie, protein, fat, carb}` booleans), and `gaps` (§3). These never come from the LLM.

## 5. Applying a proposal & the refine loop

### Apply mapping (D4)

"Choisir" writes the proposal's lines straight into the selected meals — no review step, no "IA"
chip; applied lines are indistinguishable from manual entries. The client:

1. If the day is an unsaved scaffold, **materialise** it: `POST /days/:date` (lazy creation,
   freezes `target_snapshot`).
2. For each `item`, write `POST /meals/:mealId/entries` with `kind: "referenced"`:
   - portioned: `{ food_id, unit: "portion", portion_id, served_quantity: n }`.
   - portionless: `{ food_id, unit: "g", served_quantity: grams }`.
     The server resolves `served_grams` and snapshots macros at write time; its snapshot **matches
     the proposal's `snap`** because both scale the same stored per-100 g values (the calorie-basis
     rule guarantees no drift).
3. **Plain entries only — no leftover groups** (D4). Entries remain freely editable afterward.

The AI endpoint **persists nothing**; apply uses only existing endpoints, so no new "apply"
endpoint is introduced.

### Refine loop (stateless, client-held)

Selecting a proposal + a remark produces **constraints**, accumulated **client-side** and re-sent
on every call (no session table):

- _"I don't have X"_ → add `food_id` to `excluded_food_ids` (removes X from the candidate pool).
- _"use 2 not 3" / quantity edit_ → add `{ food_id, meal_id, portion_id|null, grams }` to `pinned`
  (the solver holds that food fixed at that quantity and fits the rest around it).
- `avoid` = food-id signatures of proposals already seen, so the LLM diverges from prior rounds.

On recompute the LLM re-picks foods and the solver honours the pins + exclusions + the **unchanged**
day targets. Pinned foods are added to the day total as fixed contributions before the free
variables are optimised.

## 6. Worked oracles (test oracles)

A clean synthetic candidate table (exact per-100 g values; note **F3's stored kcal 60 ≠ its macro
arithmetic 56**, exercising the calorie-basis rule):

| id  | name            | kcal/100g | P/100g | L/100g | G/100g | portion         |
| --- | --------------- | --------- | ------ | ------ | ------ | --------------- |
| F1  | Blanc de poulet | 110       | 23     | 2      | 0      | — (5 g step)    |
| F2  | Huile d'olive   | 900       | 0      | 100    | 0      | —               |
| F3  | Yaourt grec 0%  | 60        | 10     | 0      | 4      | —               |
| F4  | Whey            | 400       | 80     | 8      | 4      | `dose` = 30 g   |
| F5  | Œuf             | 140       | 12     | 10     | 1      | `œuf` = 57 g    |
| F6  | Amandes         | 600       | 21     | 50     | 20     | —               |
| F7  | Courgette       | 20        | 2      | 0      | 3      | —               |
| F8  | Pomme           | 52        | 0      | 0      | 14     | `pomme` = 150 g |

Shared day context for all oracles: band **1550–1650**, P floor **140**, L floor **50**, G ceiling
**150**. Already entered (day-wide): **920 kcal / P 78 / L 28 / G 70** ⇒ `rem_cal ∈ [630, 730]`,
`need_protein = 62`, `need_fat = 22`, `carb_room = 80`.

**Oracle A — full fit (portionless mix).** Quantities (g): F1 200, F2 15, F3 200, F4 1 dose
(30 g), F6 10, F7 200.

- Proposal kcal = 220 + 135 + 120 + 120 + 60 + 40 = **695** (∈ [630,730]).
- P = 46 + 0 + 20 + 24 + 2.1 + 4 = **96.1** (≥ 62) · L = 4 + 15 + 0 + 2.4 + 5 + 0 = **26.4** (≥ 22)
  · G = 0 + 0 + 8 + 1.2 + 2 + 6 = **17.2** (≤ 80).
- Day total = **1615 kcal / P 174.1 / L 54.4 / G 87.2** → all hard met, under ceiling ⇒ `P = 0`,
  `fit = "full"`, `gaps = []`. (Display: 1615 kcal, P 174, L 54, G 87.)

**Oracle B — full fit with indivisible portions.** Quantities: F5 **×3** (171 g), F1 150 g,
F4 **1 dose**, F8 **×1** (150 g), F6 5 g.

- kcal = 239.4 + 165 + 120 + 78 + 30 = **632.4** (∈ band) · P = 20.52 + 34.5 + 24 + 0 + 1.05 =
  **80.07** · L = 17.1 + 3 + 2.4 + 0 + 2.5 = **25.0** · G = 1.71 + 0 + 1.2 + 21 + 1 = **24.91**.
- Day total = **1552.4 kcal** (just above `cal_min`, fully accepted — demonstrates _anywhere in
  band_) / P 158 / L 53 / G 95 ⇒ `P = 0`, `fit = "full"`.

**Oracle C — portion indivisibility.** Same set as B but suppose the ideal fat fit wanted 3.4 eggs.
The solver is restricted to `{3, 4}` eggs. `×3` gives `P = 0` (Oracle B); `×4` (228 g) would add
+79.8 kcal pushing the day to 1632 (still in band) but is dominated by `×3` on the `0.05·carb`
tie-break + lower total, so the solver returns **×3**. Asserts: no fractional portion is ever
produced; among integer counts the min-`P` one wins.

**Oracle D — closest fit, conservative bias (headline, D2/D3).** A refine excluded the user's fat
sources (F2 oil, F6 almonds — "I don't have them"), so the remaining lean set cannot reach the fat
floor without overshooting calories. Two competing candidate quantity vectors evaluate to:

- **A** — best lean fit: day = **1585 kcal** (∈ band ✓), P 175 (✓), **L 47** (floor − 3 g), G 105
  (≤ 150 ✓). `P = 8 · 3 = 24`.
- **B** — force the fat floor by piling on whey/yogurt: L 52 (✓) but day = **1672 kcal**
  (over `cal_max` by 22). `P = 1.5 · 22 = 33`.
- `24 < 33` ⇒ the solver returns **A**. **The 3 g fat shortfall is preferred over a 22 kcal
  calorie overshoot.** `fit = "closest"`, `gaps = [{ "target": "fat_floor", "short_g": 3 }]`.
  Wired as a **penalty-function oracle**: given vectors A and B, assert `P(A) < P(B)` and that the
  chosen proposal is A with the stated gap.

All four are computed at full precision and asserted at display precision per `00-conventions.md`
(kcal integer, aggregate macro grams integer).

> Provenance: feature design package `specifications/features/ai-meal-proposals/` — `spec.md`
> §2 (logic + worked oracles), `challenge.md` (D1–D5), `decisions.md`. Decisions recorded in
> `DECISIONS.md` B-123. Tuning constants in `packages/shared/src/constants/tuning.ts`.
