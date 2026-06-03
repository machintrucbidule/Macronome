# Logic spec — one-shot migration ETL (Excel → DB)

Standalone script, run once. Covers §3.10, RECONCILIATION_LOG §C1/§G5,
OPEN_GAPS #3 and #4 (both ETL-runtime; no schema impact). See `00-conventions.md`.

## 1. App start date & day kind (OPEN_GAPS #3)
- **All imported history → summary days** (`DayLog.kind = summary`): total
  calories + effective verdict + comment, read-only. **No detailed day is
  imported** — the workbook keeps full detail only for the current day (sometimes
  the previous one); detailed days are created natively in the app from go-live.
- Therefore there is no summary/detailed overlap and no cutoff to resolve at
  runtime; `app_start_date` = go-live date (detailed days begin there).
- **Import only genuinely filled days** (a calorie total present), up to today.
  Future pre-traced rows and empty rows in `Archive cal`, and forward-projected
  rows in `Suivi`, are **skipped** (OPEN_GAPS #3c).

## 2. Foods — visibility & rating
- Imported foods default to `visibility = shared` (the common catalog;
  OPEN_GAPS #6). `owner_id` = the sole v1 user.
- "Avis" → rating: `Top→3, Ok→2, Moyen→1, Bof→0, ("N/A" & blank)→null` (unrated).
- Comment column → `Food.comment`.

## 3. (nb)/(poids) merge (OPEN_GAPS #4) — source-format rules
The workbook may carry, for the same base item, a "(nb…)" row (per named unit)
and/or a "(poids)" row (per 100 g). The exact row inventory and counts are a
property of the real workbook and are **validated by the local-only migration
tests** (`*.local.test.ts` against the git-ignored `suivi_poids.xlsx`); the rules
below define the transforms, not the dataset. Categories the rules must handle:
clean (nb)+(poids) pairs, "(nb)"-only orphans, "(poids)"-only orphans, and
suffix-less foods.
- **Pairing key:** base name = the row name with the trailing `(nb…)` or
  `(poids)` suffix stripped and trimmed.
- **Clean pair:** produce ONE food.
  - per-100 g macros = the **(poids)** row (already per 100 g).
  - named portion grams = `kcal(nb) / kcal(poids)`. (Illustrative:
    `Item A` 3500/100 = 35 g; `Item B` 4350/100 = 43.5 g; `Item C` 8550/171 =
    50 g — the ratio is the source of truth.)
  - portion label: the embedded suffix value if present ("35 g" → label "unité
    (35 g)"), else "portion".
- **Embedded-gram suffix** ("(nb/35g)", "(nb / 50g)"): use the embedded
  grams; it equals the ratio (cross-check only, not a second source of truth).
- **"(nb)"-only orphans:** no per-100 g basis → **no auto-merge** →
  manual-review list (e.g. broths and drinks logged only by unit count).
- **"(poids)"-only orphans:** "… cf recette (poids)" rows → manual review
  (attach to the corresponding recipe-derived food); plain "(poids)"-only rows
  → import as a plain food, no portion.
- **Suffix-less foods:** import as-is, one food each.

## 4. Manual-review list (no silent auto-merge of ambiguous pairs)
A table emitted by the ETL for operator review, columns:
`name | reason | suggested_action`
where reason ∈ {`nb_orphan_no_basis`, `poids_orphan_recipe`,
`ambiguous_ratio`}. Nothing in this list is merged automatically.

## 5. Recipes
- `Recettes` (instructions) + `Recettes calcul` (ingredient computation) unify
  into one `Recipe` (instructions + ingredient list). Ingredients map to
  imported foods (or nested recipes) by name; unresolved names → manual review.
- Each recipe builds its derived food (see `recipes-derived-food.md`).

## 6. Daily-calorie archive → summary days
From `Archive cal` (Date, Calories, Ok?, Sport, Comment):
- `DayLog.kind=summary`, `summary_kcal = Calories`, `comment = Comment`.
- Verdict: "OK"→OK, "NOK"→NOK as the **stored effective** verdict (override);
  blank verdict on a filled day → derive auto from `summary_kcal` vs the
  period-appropriate target snapshot, no override.
- "Sport" column → best-effort map to `activity_level` (Sport→moderately_active,
  else sedentary); flagged as low-confidence in the import report.

## 7. Weight history → weigh-ins (variable periods preserved)
From `Suivi`: import each real weigh-in (`Poids réel`, date, `Tour de taille`→
waist, `Régime?`→diet_flag in_diet/not_in_diet, `Commentaire`→note), preserving
**exact dates** so variable-length periods reconstruct faithfully. Skip
forward-projected rows (date > today). The workbook's per-period activity seeds
the activity of that period's imported days where available.

## 8. Containers
From `Poids à vide` (Quoi, Poids g) → `Container(name, empty_weight_g)`,
owner = user; plus the built-in locked "Rien" (0 g).
