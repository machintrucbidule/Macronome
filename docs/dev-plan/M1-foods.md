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

- [ ] food + food_portion tables + migration; GIN trigram index
- [ ] food.repo (scoped) + foods service + routes/controllers + DTOs
- [ ] normalize() + neutral unit tests; rating constant
- [ ] Foods screen: table, edit modal, rating stars, visibility chip/filter
- [ ] integration: dup-name warning, archive-from-search, tenancy 404, 422
- acceptance: neutral unit oracles + listed integration cases green
