# M1 — Foods (catalog + search)

**Goal:** the food catalog and the diacritic-insensitive autocomplete — the first
vertical slice (DB→API→UI) and the substrate every loggable thing builds on.
Depends-on: M0.

## Scope

- Tables `food`, `food_portion` (`spec/schema/tables-catalog.md`): per-100 g macros,
  named portions (grams), `visibility` (`private|shared`) independent of `owner_id`
  (`DECISIONS.md` Gap 6), `archived_at` soft-delete.
- CRUD + list/search API (`spec/api/foods-recipes.md`): create/edit/archive; the
  visibility chip/filter/toggle (Gap 6b); duplicate active name is **non-blocking**.
- Autocomplete via `unaccent`/`pg_trgm` GIN index (`spec/schema/indexes.md`); the
  shared `normalize()` parity helper (`domain/search/normalize.ts`).
- Foods screen (`specifications/screens/food-db.md`, mockup `food-db.html`): dense
  table, create/edit modal, rating stars (0–3 vs unrated "—", Gap 7), visibility
  filter. Portion column display-only/not sortable (Gap 10).

## Files (via `module-map.md`)

API: `data/repositories/food.repo.ts` (user-scoped), `services/foods.ts`,
`http/routes/foods.ts`, `http/controllers/foods.ts`, `domain/search/normalize.ts`
(+ `normalize.test.ts`). DTOs `shared/src/dto/food.ts`; rating constant
`shared/src/constants/rating.ts`.
Web: `features/foods/` (page + `components/` + edit modal), `api/foods.ts`,
`api/loggableSearch.ts`, components `DataTable/`, `RatingStars/`, `Form/`
(Autocomplete, SearchField, Chip).

## Acceptance criteria

- **Unit (neutral oracles):** `normalize()` unaccent parity cases (e.g. accented vs
  plain match); rating map helper (`null`=unrated, 0=Bof … 3=Top; "≥1" filter excludes
  both Bof and unrated) per `spec/logic/00-conventions.md`.
- **Integration** (`testing.md` §2): duplicate active name → **201 +
  `warnings:['duplicate_name']`** (saved); archive removes the row from search;
  another user's food → **404**; malformed body → **422** with per-field `details`.
- **e2e (smoke):** create a food, see it in search; archive it, see it disappear.

## Size check

Table + modal decompose per `modularity.md` §2 (page container + sub-components;
edit modal reuses `Modal/` shell + `Form/`). All files ≤300 lines.

## Checklist

- [x] food + food_portion tables + migration; GIN trigram index
- [x] food.repo (scoped) + foods service + routes/controllers + DTOs
- [x] normalize() + neutral unit tests; rating constant
- [x] Foods screen: table, edit modal, rating stars, visibility chip/filter
- [x] integration: dup-name warning, archive-from-search, tenancy 404, 422
- [x] acceptance: neutral unit oracles + listed integration cases green (+ e2e smoke)

### Deferred from M1 (tracked so nothing is dropped)

- **`GET /search/loggable` (food ∪ recipe-derived) + web `api/loggableSearch.ts`** →
  deferred to **M5** (needs the recipe table). M1 ships foods-only search via
  `GET /foods?q=`. Recorded in `M5-recipes.md`.
- **`food.recipe_id` FK** to the recipe table → added in **M5** (column exists now as a
  plain nullable Uuid; no Prisma relation, FK in migration SQL). Recorded in `M5-recipes.md`.
- **UI component variants not needed by Aliments** (full `TopNav`/`PrimaryNav`/
  `AccountMenu`, the autocomplete dropdown, remaining Button/Form/Modal/states variants,
  table horizontal-scroll + sticky-appbar offset, locale-aware number formatting) →
  built minimally for M1; remaining variants recorded in `M3-daily-log.md` (autocomplete)
  and `M9-polish.md` (nav, a11y, number formatting, table scroll).

## Implementation notes

- `normalized_name` is maintained by the app `normalize()` helper on write
  (`domain/search/normalize.ts`); `unaccent`/`pg_trgm` extensions installed in SQL; the
  `pg_trgm` GIN index backs accent-insensitive search. The parity unit test asserts the
  app key matches `unaccent(lower(name))`.
- No Prisma-level relations on `food`/`food_portion` (the `check:schema` parser treats a
  relation field as a column); FKs (`food.owner_id`, `food_portion.food_id` CASCADE) and
  all CHECK constraints live in the migration SQL. The auto-generated `DROP TABLE session`
  was removed from the migration (session table is infra, lives in SQL).
