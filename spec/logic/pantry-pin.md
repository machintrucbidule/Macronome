# Logic spec — garde-manger pin (live model)

Covers OPEN*GAPS #8 as **revised by B-045** (`DECISIONS.md` Gap 8). The pin (📌) marks a
food as recurring in a meal slot. See `00-conventions.md`, `day-snapshot-verdict.md`
(contrast: the target snapshot \_is* frozen; the pin is _not_).

## 1. Single source of truth

`pantry_item(user_id, meal_slot_name, food_id)` is the **only** place the pin lives. The
Paramètres editor and the Repas 📌 are two views of it; editing either updates everywhere.
There is **no** per-line stored flag (the former `meal_entry.is_pinned` column is dropped).

## 2. Derived display (read)

For each rendered meal entry:

```
is_pinned = entry.kind == 'referenced'
            AND entry.food_id IS NOT NULL
            AND pantry_item exists for (user, meal.slot_name, entry.food_id)
```

So the 📌 icon on **every** day (past / present / future) reflects the live list. An
archived food keeps its pin row, so a logged line for it still shows the icon (it is just
not prefilled on new days). Deriving the icon changes **no** macros, totals, or verdict —
history stays frozen.

## 3. Pin cascade — Option C (today + future)

Pinning `(slot S, food F)` (via Paramètres `POST /pantry` or Repas 📌):

1. Upsert the `pantry_item` (idempotent; dedup → 409 `pantry_duplicate` on a direct
   re-add from Paramètres). The row carries a **prefill `unit`** (default `g`) and, when
   `unit='portion'`, a `portion_id` (GM-2/B-092). Pinning from a day's 📌 captures **that line's**
   `unit`/`portion_id` onto the new pin (GM-2/B-093).
2. **Add** a qty-0 referenced line for `F` to every existing day with `date >= today`
   whose slot-`S` meal does **not** already list `F` (appended at the meal's end), created with the
   pin's stored `unit`/`portion_id` (quantity & grams stay 0).
3. **Past days (`date < today`) are untouched.**
4. Future **uncreated** days are covered by prefill at day creation (they read the current
   pantry list, including each pin's `unit`/`portion_id`).

When pinning from a day's 📌, that day already lists `F`, so step 2 skips it (no
duplicate).

### Prefill unit (GM-2)

The qty-0 prefill line — whether materialized by the add cascade (step 2), at day creation (step 4),
or reset by **clear-the-day** (B-046) — uses the pin's stored `unit`/`portion_id`. If `unit='portion'`
but `portion_id` is null (the named portion was deleted → `ON DELETE SET NULL`), prefill falls back
to `g`. Changing a pin's unit (Paramètres `PATCH /pantry/:id`, or editing a pinned line's unit on
Repas — **the line drives the pin**, GM-2/B-093) re-syncs `pantry_item.unit/portion_id`, then runs
the **unit cascade**: every qty-0 referenced line for `(S, F)` on `date >= today` is updated to the
new unit (grams stay 0); past days and qty>0 lines are untouched.

### Default unit when adding a food/recipe (B-109)

When a **new** line is added to slot `S` via the Repas picker (not a prefilled pin line, and not a
re-pick of an existing line), its starting `unit`/`portion_id` follow this precedence:

1. **Pin prefill** — if `(S, F)` is pinned, use the pin's stored `unit`/`portion_id` (a pin with
   `unit='portion'` but null `portion_id`, i.e. a deleted portion, falls back to `g`). Prefill wins.
2. **First named portion** — else, if `F` declares portions, the **first alphabetically** (the
   picker list is `label asc`). A **recipe** carries exactly one auto portion `"portion"` (§5,
   `recipes-derived-food.md`), so a recipe defaults to **one part**, not grams.
3. **Grams** — else `g`.

Quantity starts at 0 (the user then types it). This is an input default only — no macro/total/verdict
is computed here (the line is still server-validated and snapshotted on save).

## 4. Unpin cascade

Unpinning `(slot S, food F)` (via Paramètres `DELETE /pantry/:id` or Repas unpin):

1. Delete the `pantry_item`.
2. **Delete** every qty-0 referenced line for `F` in slot-`S` meals across **all** the
   user's days (they existed only because of the pin).
3. **Keep** lines with `served_quantity > 0` — they are real logged food; they simply
   lose the derived 📌 icon (step 1 already removed the source).
4. Future uncreated days stop prefilling `F` automatically (shorter pantry list).

## 5. Worked examples (oracles)

Setup: food `F` pinned to slot `Petit déjeuner`.

- **Pin, Option C:** days exist for `D-30` (past), `today`, `D+30` (future), none listing
  `F`. After pinning `F`:
  `D-30 breakfast entries for F = 0` · `today = 1 (qty 0, is_pinned=true)` ·
  `D+30 = 1 (qty 0, is_pinned=true)`.
- **Unpin cascade:** `D1` has `F` logged at qty 200; `D2` has `F` at qty 0 (prefilled).
  After unpinning `F`:
  `D1 keeps F (qty 200, is_pinned=false)` · `D2 drops the F line (0 entries)` ·
  a brand-new day no longer prefills `F`.
- **Prefill unit (GM-2):** `F` pinned with `unit='portion'`, `portion_id=P` (`P = 'œuf' (57 g)`).
  A new day's `Petit déjeuner` prefills `F` at `qty 0, unit='portion', portion_id=P, grams 0`.
  After `PATCH /pantry/:id {unit:'kg'}`: today's + future qty-0 `F` lines become `unit='kg'`
  (grams still 0); a `D-1` line and any qty>0 `F` line keep their unit. If `P` is later deleted,
  the pin's `portion_id` → null and prefill falls back to `unit='g'`.
- **Default unit on add (B-109):** in slot `Petit déjeuner`, adding food `G` with portions
  `['assiette', 'bol']` (label-asc) and **not** pinned → new line `unit='portion'`,
  `portion_id=(assiette)`. Adding plain food `H` with no portions → `unit='g'`. Adding **recipe**
  `R` (single auto portion `"portion"`) → `unit='portion'` (one part). If `G` is pinned in that
  slot with `unit='kg'`, adding `G` instead defaults to `unit='kg'` (pin prefill wins).
