# Logic spec — leftover proration (the "plate" deduction)

Covers §3.4, RECONCILIATION_LOG §E1/§G6, OPEN_GAPS #13 (re-editable, frozen
container). See `00-conventions.md`.

## 1. Entities & invariants
- Each `MealEntry` stores `served_grams` (the raw weighed/portion→grams input).
- A `LeftoverGroup` belongs to a meal and references the subset of that meal's
  entries that **shared one plate**. It stores: `container_name`, `tare_g`
  (frozen value snapshot at apply time, NOT a live FK), `gross_grams`.
- `consumed_grams` per entry is **derived**, never destructively overwritten
  (re-editable; OPEN_GAPS #13).

## 2. Eligible lines
The leftover modal lists only meal lines with `served_grams > 0`. Hidden:
zero-quantity pantry lines, and weightless custom lines (no `served_grams`).

## 3. Net leftover
`net_leftover_g = gross_grams − tare_g`
- Default container "Rien" → `tare_g = 0` (enter a net leftover directly).

## 4. Validation — BLOCK + warn, never clamp (RECONCILIATION_LOG §E1)
Let `served_total = Σ served_grams over the selected lines`.
- **Block** the apply (write nothing) if either:
  - `gross_grams < tare_g`  (net would be negative), or
  - `net_leftover_g > served_total`  (leftover exceeds what was served).
- Warning text surfaces the offending input (gross, container, or selection).
- The leftover is **never** silently clamped to 0.

## 5. Proration (only when valid)
For each selected line `i`:
```
allocated_leftover_i = net_leftover_g × served_grams_i / served_total
consumed_grams_i     = served_grams_i − allocated_leftover_i
```
Lines **not** in any group are fully consumed (`consumed = served`).

## 6. Macro/kcal scaling (RECONCILIATION_LOG §G6)
Each entry's snapshot macros are the served-quantity totals; consumed values
scale by `consumed_grams_i / served_grams_i`:
```
consumed_kcal_i = snapshot_kcal_i × consumed_grams_i / served_grams_i
```
(same for fat/carb/protein). Custom lines **with** a `served_grams` participate
and scale identically; weightless customs are excluded.

## 7. Re-edit (OPEN_GAPS #13)
Because `served_grams` is retained and `consumed` is derived, a past day's
LeftoverGroup can be reopened and its `gross_grams` / container / line selection
changed; consumed values recompute. Editing or deleting the `Container` catalog
row never affects the group (container is frozen as `container_name` + `tare_g`).

## 8. Worked example (oracle — the canonical plate)
```
inputs:
  selected lines (served_grams): Food A 500, Food B 300, Food C 200
  not selected: Side D 125 (eaten whole)
  container "Bowl" tare_g = 408 ; gross_grams = 508
computation:
  served_total = 1000
  net_leftover_g = 508 − 408 = 100   (valid: 0 ≤ 100 ≤ 1000)
  Food A: alloc = 100×500/1000 = 50  → consumed 450
  Food B: alloc = 100×300/1000 = 30  → consumed 270
  Food C: alloc = 100×200/1000 = 20  → consumed 180
  Side D: untouched → consumed 125
expected:
  consumed_grams = {Food A 450, Food B 270, Food C 180, Side D 125}
  each selected line's kcal/macros ×0.9 (=consumed/served); Side D unchanged
```

## 9. Worked example — blocked
```
inputs: served_total=1000, container "Bowl" tare_g=408, gross_grams=300
  net = 300 − 408 = −108  → gross < tare → BLOCK + warn, nothing written.
inputs: served_total=1000, tare_g=408, gross_grams=1500
  net = 1092 > 1000  → leftover exceeds served → BLOCK + warn.
```
