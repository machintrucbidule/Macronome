# Logic spec — garde-manger pin (live model)

Covers OPEN*GAPS #8 as **revised by B-045** (`DECISIONS.md` Gap 8). The pin (📌) marks a
food as recurring in a meal slot. See `00-conventions.md`, `day-snapshot-verdict.md`
(contrast: the target snapshot \_is* frozen; the pin is _not_).

## 1. Two sources of truth — cross-day registry + per-line flag (B-198)

The pin has **two** stores that together give per-line granularity while staying live:

- `pantry_item(user_id, meal_slot_name, food_id)` — the **cross-day registry**: whether
  food `F` recurs in slot `S` for the user (drives prefill on new/future days + carries the
  prefill `unit`/`portion_id`). The Paramètres editor and the Repas 📌 both read/write it.
- `meal_entry.pinned` (boolean, B-198) — a **per-line flag** marking that _this specific
  line_ is a garde-manger line. Set on the qty-0 placeholder lines the pin cascade creates,
  and on any line the user explicitly pins. A **manually re-added** line of an
  already-pinned food is a NORMAL line: `pinned=false` by default (the user may pin it, §3).

This replaces the pre-B-198 model where the pin was keyed **only** per `(slot, food)` with no
per-line concept, which made a manually re-added duplicate render pinned and share the pin's
destructive cascades. (Reverses part of B-045's "no per-line flag" — see `DECISIONS.md`.)

## 2. Derived display (read) — hybrid (B-198)

For each rendered meal entry:

```
is_pinned = entry.kind == 'referenced'
            AND entry.food_id IS NOT NULL
            AND entry.pinned == true                       -- this line is a garde-manger line
            AND pantry_item exists for (user, meal.slot_name, entry.food_id)
```

Both conditions are required: the per-line flag distinguishes a garde-manger line from a
normal duplicate of the same food; the `pantry_item` check keeps the icon **live** — unpinning
removes the row so **every** line of `F` in slot `S` (past / present / future) shows unpinned
at once, with no per-line write (B-045 liveness preserved). An archived food keeps its pin
row, so a garde-manger line for it still shows the icon (just not prefilled on new days).
Deriving the icon changes **no** macros, totals, or verdict — history stays frozen.

## 3. Pin cascade — Option C (today + future)

Pinning `(slot S, food F)` (via Paramètres `POST /pantry`, or the Repas 📌 on a specific line):

0. **Set `pinned=true` on the acting line** (Repas 📌 — the line the user pinned; Paramètres
   pins have no acting line). This is what makes that line a garde-manger line (§2).
1. Upsert the `pantry_item` (idempotent; dedup → 409 `pantry_duplicate` on a direct
   re-add from Paramètres). The row carries a **prefill `unit`** (default `g`) and, when
   `unit='portion'`, a `portion_id` (GM-2/B-092). Pinning from a day's 📌 captures **that line's**
   `unit`/`portion_id` onto the new pin (GM-2/B-093).
2. **Add** a qty-0 `pinned=true` referenced line for `F` to every existing day with
   `date >= today` whose slot-`S` meal does **not** already list a **pinned** line for `F`
   (appended at the meal's end), created with the pin's stored `unit`/`portion_id` (quantity &
   grams stay 0). Dedup is on a _pinned_ line for `F`, so a day that lists `F` only as a normal
   (unpinned) duplicate still gets its garde-manger placeholder.
3. **Past days (`date < today`) are untouched.**
4. Future **uncreated** days are covered by prefill at day creation (they read the current
   pantry list, including each pin's `unit`/`portion_id`); prefilled lines are `pinned=true`.

When pinning from a day's 📌, that line is the acting line (step 0 sets its flag), so step 2's
dedup already sees a pinned `F` line on that day and skips it (no duplicate placeholder).

**Pinning a duplicate (B-198).** If `F` is already pinned in slot `S` and the user pins a
**second** line of `F` in the same meal, step 0 sets that line's flag too and step 1 is a
no-op upsert — both lines are now garde-manger lines (each shows 📌); the pantry_item is
unchanged (one registry row). See the unpin reference count in §4.

### Prefill unit (GM-2)

The qty-0 prefill line — whether materialized by the add cascade (step 2), at day creation (step 4),
or reset by **clear-the-day** (B-046) — uses the pin's stored `unit`/`portion_id`. If `unit='portion'`
but `portion_id` is null (the named portion was deleted → `ON DELETE SET NULL`), prefill falls back
to `g`. Changing a pin's unit (Paramètres `PATCH /pantry/:id`, or editing a pinned line's unit on
Repas — **the line drives the pin**, GM-2/B-093) re-syncs `pantry_item.unit/portion_id`, then runs
the **unit cascade**: every qty-0 **`pinned=true`** referenced line for `(S, F)` on
`date >= today` is updated to the new unit (grams stay 0); past days, qty>0 lines, and normal
(unpinned) duplicates are untouched.

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

## 4. Unpin cascade — per-line, reference-counted (B-198)

Two triggers unpin a garde-manger line: the Repas **unpin 📌** (toggle off) and **deleting
(×) a pinned line** — both behave identically (owner decision). Paramètres `DELETE /pantry/:id`
unpins `(S, F)` directly (no acting line → skip the reference count, go straight to the wipe).

**Reference count (Repas unpin / delete a pinned line).** Let the acting line be a
`pinned=true` line of `F` in meal `M` on day `D`. Clear its flag (unpin) or remove it
(delete), then count the **remaining** `pinned=true` lines for `(S, F)` in **that same meal
`M` on day `D`**:

- **≥ 1 remaining** → the food stays pinned: `pantry_item` and all other days are untouched.
  (The only way to have >1 pinned line for one `(S, F)` in a meal is a user-pinned duplicate,
  §3.) The acting line simply becomes normal (unpin) or is gone (delete).
- **0 remaining** → the food is **unpinned** — run the wipe below.

**Wipe** (Paramètres unpin, or the last pinned line removed):

1. Delete the `pantry_item`.
2. **Delete** every qty-0 **`pinned=true`** referenced line for `F` in slot-`S` meals across
   **all** the user's days (the garde-manger placeholders). Normal qty-0 duplicates
   (`pinned=false`) are **left untouched**.
3. **Keep** lines with `served_quantity > 0`, but **clear their `pinned` flag** on today +
   future so they read as normal logged lines (past days lose the derived icon anyway via §2's
   `pantry_item` check).
4. Future uncreated days stop prefilling `F` automatically (shorter pantry list).

## 5. Worked examples (oracles)

Setup: food `F` pinned to slot `Petit déjeuner`.

- **Pin, Option C:** days exist for `D-30` (past), `today`, `D+30` (future), none listing
  `F`. After pinning `F`:
  `D-30 breakfast entries for F = 0` · `today = 1 (qty 0, is_pinned=true)` ·
  `D+30 = 1 (qty 0, is_pinned=true)`.
- **Unpin cascade:** `D1` has `F` logged at qty 200; `D2` has `F` at qty 0 (prefilled).
  After unpinning `F`:
  `D1 keeps F (qty 200, pinned=false, is_pinned=false)` · `D2 drops the F line (0 entries)` ·
  a brand-new day no longer prefills `F`.
- **Manually re-added duplicate (B-198):** `F` pinned in `Petit déjeuner`; `today` has the
  garde-manger line (`qty 0, pinned=true, is_pinned=true`). The user manually adds a **second**
  `F` line at `qty 2` → it is `pinned=false, is_pinned=false` (a normal line). Then:
  - Clicking **unpin/delete on the second line** does nothing to the pin (it was never pinned);
    the garde-manger line and all other days are untouched.
  - **Unpinning the garde-manger line** (reference count → 0 pinned lines remain in the meal)
    wipes `F`: the placeholder is gone today+future, the `qty 2` line stays as a normal line.
  - **"Tout effacer"** on `today` deletes the `qty 2` line (normal) and keeps-and-zeroes the
    garde-manger line only.
- **Reference count (B-198):** the user also pins the second `F` line → both are
  `pinned=true, is_pinned=true` (one `pantry_item`). Unpinning **one** leaves `≥1` pinned `F`
  line in the meal → `F` stays pinned (the other line + future placeholders untouched).
  Unpinning the **second** → `0` remain → `F` is wiped (pantry_item deleted, future
  placeholders removed).
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
