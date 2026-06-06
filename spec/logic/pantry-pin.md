# Logic spec — garde-manger pin (live model)

Covers OPEN_GAPS #8 as **revised by B-045** (`DECISIONS.md` Gap 8). The pin (📌) marks a
food as recurring in a meal slot. See `00-conventions.md`, `day-snapshot-verdict.md`
(contrast: the target snapshot _is_ frozen; the pin is _not_).

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
   re-add from Paramètres).
2. **Add** a qty-0 referenced line for `F` to every existing day with `date >= today`
   whose slot-`S` meal does **not** already list `F` (appended at the meal's end).
3. **Past days (`date < today`) are untouched.**
4. Future **uncreated** days are covered by prefill at day creation (they read the current
   pantry list).

When pinning from a day's 📌, that day already lists `F`, so step 2 skips it (no
duplicate).

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
