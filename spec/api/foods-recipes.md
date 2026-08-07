# API — foods, recipes, containers

See `00-conventions.md`. All scoped to the authenticated user.

## Foods

- `GET /foods` — browse foods only (no recipes). Query: `q` (autocomplete),
  `min_rating` (1|2|3 — excludes Bof 0 and unrated when ≥1), `visibility`
  (private|shared), `source` (manual|ciqual|chronodrive — absent = every source;
  `recipe` is not accepted, those rows are excluded from this list by construction),
  `include_archived` (bool, default false),
  `sort` ∈ {name,kcal,fat,carb,protein,rating,source,visibility,usage} (Portion NOT sortable,
  OPEN_GAPS #10), `dir`, `limit`, `cursor` **or `offset`** (LD-1/B-303, mutually exclusive —
  `00-conventions.md` §List behaviour). **`usage`** (FU-1) orders by the food's
  **meal-log count over the last 90 days** (most-used first for `dir=desc`), ties broken by
  most-recent use then name; usage is derived from `meal_entry` at query time (no stored
  column). Only **consumed** entries count — those with `served_quantity > 0`; quantity-0
  lines (unfilled pinned placeholders, B-045) are not usage and do not count (B-157). **Every**
  `GET /foods` list response carries a `usage` integer on each Food (the 90-day consumed
  count), regardless of `sort` (B-156).
  Every response also carries **`with_comment`** (LD-1/B-303 follow-up): how many of the `total`
  matching rows carry a comment. An Aliments row is **taller** when it draws its comment sub-line,
  so a client reserving height for rows it has not loaded needs the exact split — the first page is
  not a representative sample of the rest, and an average taken from it is wrong for every row
  beyond it. Counted on the **same predicate as `total`** (unlike `sources` below), and excluding
  empty comments, which draw no sub-line.
  Every response also carries **`sources`** — the provenance values actually present in the
  user's catalog, sorted, **`recipe` excluded and archived foods included**. It is deliberately
  computed **independently of the query's own filters** (`q`, `min_rating`, `visibility`,
  `source`, `include_archived`), so the client's Source filter offers a stable set that does not
  shift while the user types, and offers nothing when a provenance is absent (B-295).
  → 200 `{data:[Food], next_cursor, total, sources}` (`total` = rows matching the filters, B-278).
- `GET /foods/:id` → 200 Food | 404.
- `POST /foods` — create. Body: `{name, kcal_per_100g, fat_per_100g,
carb_per_100g, protein_per_100g, comment?, rating?(null|0..3),
visibility?(default 'private'), source?(default 'manual'),
named_portions:[{label,grams}]}`.
  Validation: macros ≥ 0; grams > 0; labels unique per food. `source` ∈
  {`manual`,`ciqual`,`chronodrive`} — provenance declared by the client that built the
  draft (a Chronodrive product prefill, an adopted `food_ref` entry, or plain typing;
  the macro-label parser is `manual`). **`recipe` is rejected (422)** — it is
  server-owned and only `recipe-derived-food` writes it. Duplicate active
  name → 200/201 with `warnings:['duplicate_name']` (non-blocking). → 201 Food.
- `PATCH /foods/:id` — edit. Editing macros affects **future** logs only (past
  meal_entry snapshots untouched). `source` accepts the same restricted vocabulary as
  create (`recipe` rejected, 422). It is **never** rewritten as a side effect of an edit —
  a food keeps its provenance through any change to its values (B-290) — but the user may
  **deliberately** correct it from the food form (B-295). → 200 Food.
- `POST /foods/from-ref` — adopt a Ciqual reference entry (B-293). Body `{ref_id, locale?}`.
  Copies the entry into a real food with the adoption defaults: name **in the requested locale**
  (default `fr`, D6), the four macros, `source:'ciqual'`, **`visibility:'private'`**,
  `ai_proposable:true`, no named portion, unrated. **`private` since BE-1/B-304**, reversing CIQ-3's
  `shared`: the owner would rather every food he did not deliberately share start private, and
  `visibility` is inert in v1 anyway, so the change touches the chip, the filter and the export
  column only. Already-adopted foods keep `shared` (D20) — no migration. **Idempotent** — if an active food of that
  normalized name already exists it is returned untouched rather than duplicated, so a double click
  or a second pick of the same entry cannot create two foods. → **201** Food when created, **200**
  Food when it already existed; unknown `ref_id` → 404. This is what the search pickers call when
  the user picks a reference entry; the Aliments catalog view instead prefills the food form, so the
  user can rename before saving (B-292).
- `POST /foods/:id/archive` → 200 (sets archived_at; removed from search/list).
- `POST /foods/:id/restore` → 200.
- `GET /foods/ids` — the ids matching a filter, **unpaginated** (BE-1). Same query vocabulary as
  `GET /foods` minus `limit`/`cursor`/`offset`/`sort`/`dir` — an id set has no order and no page.
  → 200 `{data:["<uuid>", …]}`. It exists for the "select everything matching the current filter"
  header checkbox: the list is paginated 50 rows at a time, so the client cannot know the rows it
  has not loaded. The client **freezes** what it gets back (D10) and edits that exact set, rather
  than asking the server to re-resolve the filter at write time — so what is written is what the
  count promised, even if the catalogue changed meanwhile.
- `PATCH /foods/bulk` — edit several foods at once (BE-1). Body
  `{ids:[<uuid>…], patch:{rating?, source?, visibility?, ai_proposable?, comment?}}` → 200
  `{updated:n}`. Exactly the five fields the batch form offers; the macros, the name and the named
  portions are **not** bulk-editable — they are per-food values, and editing them across a
  selection has no meaning. Each field follows the single-row `PATCH` semantics: absent = leave
  unchanged, `comment:null` = clear, `rating:null` = « Pas noté ». `source` keeps its restricted
  vocabulary (`recipe` rejected, 422). Recipe-derived rows are never touched. All-or-nothing,
  cross-tenant → 404 with nothing written, ceilings and `empty_patch` per
  `00-conventions.md` §Bulk writes.
- `POST /foods/bulk/undo` — restore the values the last `PATCH /foods/bulk` overwrote. No body.
  → 200 `{restored:n}`; **409 `nothing_to_undo`** on a second call or with no batch on record
  (`00-conventions.md` §Bulk writes).
- `POST /foods/parse-label` — **stateless** macro-label parser (PM-1/B-114). Body
  `{label_text}` (1..10000 chars) = nutrition text pasted from a grocery site. Deduces
  the per-100 g figures per `logic/macro-label-parser.md`; persists nothing. Found macros
  only (any of the four may be absent → the client leaves that field untouched). →
  200 `{data: ParseLabel, warnings?:['kcal_from_kj'|'scaled_from_ref'|'macro_missing']}`.
  Structurally-impossible input → **422** `{error:{code}}` with `code` ∈
  `{reconstituted_label, no_reference, unparseable}` (writes nothing).

**ParseLabel** payload (per 100 g; each field optional — only the macros found):

```json
{ "kcal_per_100g": 362, "fat_per_100g": 15, "carb_per_100g": 32, "protein_per_100g": 34 }
```

**Food** payload:

```json
{ "id","owner_id","name","kcal_per_100g","fat_per_100g","carb_per_100g",
  "protein_per_100g","comment","rating": null,
  "visibility":"private","source":"manual","ai_proposable":true,"recipe_id":null,
  "named_portions":[{"id","label","grams"}],"archived_at":null }
```

## Food reference catalog

Read-only browse over `food_ref`, the global Ciqual catalog shipped inside the image
(`spec/schema/tables-catalog.md` §food_ref, `spec/logic/ciqual-catalog.md`). Reference data, not
user data: nothing here is owned, created or edited through the API — the two endpoints below only
read. A reference entry becomes a real food only when the user adopts it, and an adoption is always
a **copy**, never a link: no column ties a food back to the entry it came from, so a later Ciqual
edition can change or drop a row without touching anything the user saved. Two doors lead to it —
the Aliments catalog prefills the food form (B-292), the search pickers call
`POST /foods/from-ref` (B-293) — and both land on the same defaults.

- `GET /food-refs` — browse the catalog. Query: `q` (autocomplete — matches the **French and
  English** normalized names at once, so "pomme" and "apple" find the same entry, D6), `group`
  (a level-1 food-group label, from `/food-refs/groups`), `locale` (`fr`|`en`, default `fr`),
  `sort` ∈ {name,kcal,fat,carb,protein}, `dir`, `limit`, `cursor` **or `offset`** (LD-1/B-303,
  mutually exclusive). → 200 `{data:[FoodRef], next_cursor, total}` (standard list,
  `00-conventions.md`). This is the catalogue `offset` was added for: 3 400 rows, so a scrollbar
  drag lands thousands of rows past anything a cursor could name.
  **`locale` drives three things at once**: which name column `sort=name` orders by, which name the
  `already_owned` probe compares, and — by symmetry — which group labels `group` matches. It is not
  a display preference: the client receives both languages and picks. It exists because an adopted
  food takes its name **in the UI locale current at adoption time** (D6), so "do I already have
  this?" must ask about the name that _would_ be created.
- `GET /food-refs/groups` — the level-1 food-group labels present in the catalog, sorted, in the
  requested `locale` (default `fr`). Feeds the catalog's group filter. Includes the `non classé` /
  `unclassified` label of `spec/logic/ciqual-catalog.md` §5. → 200 `{data:[string]}`.

Both require authentication. **`already_owned` is the only user-scoped field of this resource** —
true when the user has an **active** (non-archived) food whose `normalized_name` equals the
reference entry's normalized name in the requested locale. It never blocks: an owned entry stays
addable, it is only marked (D11).

**FoodRef** payload:

```json
{ "id","code","name_fr","name_eng","group_label_fr","group_label_eng",
  "kcal_per_100g","fat_per_100g","carb_per_100g","protein_per_100g",
  "energy_derived": false, "already_owned": false }
```

`energy_derived` is carried for provenance (`spec/logic/ciqual-catalog.md` §4.2) but **not
surfaced** in v1 (owner decision, B-292): the catalog shows a homogeneous kcal column.

## Recipes

- `GET /recipes` — recipes only. Query: `q`, `min_rating` (1|2|3 — excludes Bof 0
  and unrated when ≥1, mirrors foods), `include_archived`, `sort` ∈
  {name,kcal,fat,carb,protein,batch,servings,weight_per_portion,rating} (column order),
  `dir`, `limit`, `cursor` **or `offset`** (LD-1/B-303, mutually exclusive).
  **`kcal`, `fat`, `carb`, `protein` and `weight_per_portion`** (RS-1/B-306) have **no stored
  column** — the per-100 g macros live on the recipe's derived food, and weight/portion is
  `total_batch_grams / servings`. They are therefore **ranked at query time over the whole
  filtered match set**, ties broken by name then id: a total order, identical across paginated
  calls, which is what lets `cursor` and `offset` slice it coherently. `next_cursor`, `offset`
  and `total` behave exactly as on the column sorts. A recipe whose macros compute to **0 is
  ordered on that 0** like any other value — the NULLS-LAST rule (B-299) applies to `rating`
  alone, the only nullable sortable field here.
  → 200 `{data:[RecipeSummary], next_cursor, total}` (`total` = rows matching the filters,
  B-278; incl. derived per-100 g, batch, `batch_weight_auto`, servings, weight/portion, rating).
- `GET /recipes/:id` → 200 RecipeFull (ingredients + instructions + derived +
  rating + `batch_weight_auto`).
- `POST /recipes` — `{name, instructions?, rating?(null|0..3), total_batch_grams?,
batch_weight_auto?, servings(≥1),
ingredients:[{ref_type,ref_id,quantity,unit,portion_id?,order_index}]}`.
  Validation: servings ≥ 1; total_batch_grams > 0 (default Σ ingredient grams);
  **transitive cycle check** — reject an ingredient that makes the graph cyclic
  → 422 `{details:{ingredient:'would_create_cycle'}}`. No custom-inline
  ingredients. On save (re)builds the derived food + auto "portion" named
  portion (= batch/servings). → 201.
  **`batch_weight_auto`** (RW-1): `true` ⇒ the batch weight is server-maintained
  = Σ ingredient grams (`total_batch_grams` must be **absent** — both present
  → 422 `{details:{total_batch_grams:'conflicts_with_auto'}}`); default on create
  = `true` when `total_batch_grams` is absent, `false` when present.
- `PATCH /recipes/:id` — same (incl. `rating`); edits recompute the derived food
  **going forward**; nested-recipe edits cascade to parents going forward. → 200.
  Partial semantics for the flag: absent ⇒ the stored state is kept (an **auto**
  recipe re-resolves batch = Σ of the final ingredients; sending
  `total_batch_grams` alone flips the recipe to manual); `true` ⇒ batch
  re-resolves to Σ (same both-present 422 as POST).
- `POST /recipes/:id/archive` · `POST /recipes/:id/restore`.
- `GET /recipes/ids` — the ids matching a filter, **unpaginated** (BE-1). Same query vocabulary as
  `GET /recipes` minus paging and sorting; → 200 `{data:["<uuid>", …]}`. Same purpose as the foods
  twin above.
- `PATCH /recipes/bulk` — edit several recipes at once (BE-1). Body `{ids:[<uuid>…],
patch:{rating?}}` → 200 `{updated:n}`. **`rating` is the only bulk-editable field**, deliberately
  (owner): a recipe's other editable values — `servings`, `total_batch_grams` — **recompute its
  derived food**, so setting them across a selection would move the per-portion and per-100 g
  figures of every recipe touched, and a bulk `total_batch_grams` would additionally flip
  `batch_weight_auto` recipes to manual. `rating` changes nothing but the stars.
  Semantics, ceilings and failure modes per `00-conventions.md` §Bulk writes.
- `POST /recipes/bulk/undo` — restore the ratings the last `PATCH /recipes/bulk` overwrote. No
  body. → 200 `{restored:n}`; **409 `nothing_to_undo`** otherwise.
- `POST /recipes/preview` — **stateless** live recompute for the builder (an
  unsaved draft). Body = the recipe body **without `name`**: `{servings(≥1),
total_batch_grams?, ingredients:[{ref_type,ref_id,quantity,unit,portion_id?,
order_index}]}`. Resolves each ingredient (user-scoped) and returns the derived
  figures **without persisting anything** (no row written, no derived-food rebuild,
  **no cycle check** — read-only). Empty `ingredients` → all figures `0`.
  → 200 `{data: RecipePreview}`. No `batch_weight_auto` here: an auto draft simply
  omits `total_batch_grams` and the response's batch is Σ (RW-1).

**RecipePreview** payload (derived only; never posted):

```json
{ "total_ingredient_grams","total_batch_grams","servings",
  "kcal_per_100g","fat_per_100g","carb_per_100g","protein_per_100g",
  "weight_per_portion_g",
  "total_macros":{"kcal","fat","carb","protein"},
  "per_portion":{"kcal","fat","carb","protein"},
  "ingredients":[{"ref_type","ref_id","ref_name","quantity","unit","portion_id",
    "order_index","grams","kcal","fat","carb","protein","ref_named_portions":[...]}] }
```

Derived per-100 g / per-portion are computed server-side
(`logic/recipes-derived-food.md`); the client never posts them. The builder's live
yield panel reads them from `POST /recipes/preview` while editing, and the persisted
figures from `GET /recipes/:id` after save (cf. `screens/recipe.md` live recompute).

## Combined log search (food ∪ recipe-derived food ∪ Ciqual reference)

- `GET /search/loggable?q=` — diacritic-insensitive autocomplete over foods AND
  recipe-derived foods (what the Daily log / cook mode / recipe ingredient picker / the
  garde-manger picker use). Query: `q`, `limit` (default 20, max 50), `locale`
  (`fr`|`en`, default `fr`). Excludes archived. **Ordered most-used-first** (FU-1): by the item's
  90-day meal-log count of **consumed** entries (`served_quantity > 0`; quantity-0 placeholder
  lines do not count, B-157), ties broken by most-recent use then name (recipes rank by
  their own logged usage, via their derived food).
  → 200 `{data:[{id,name,kind:'food'|'recipe',origin:'own'|'ciqual_ref',recipe_id,named_portions:[...]}]}`.

**Ciqual reference entries in the results (B-293).** When — and only when — `q` is supplied, the
user's own items are followed by matching entries of the reference catalog, filling whatever slots
remain under `limit`. Two rules make that tail safe:

- **Own first, always.** The FU-1 order above governs the user's own block and is untouched; the
  reference tail is appended after it and can never displace an own item. With no `q` the response
  is exactly what it was before B-293 — the picker opens on the user's habits, not on the catalog.
- **A reference entry the user already has is not offered at all** (D11): excluded when its
  normalized name in the requested `locale` matches one of the user's **active** foods. Their own
  food wins; the catalog does not duplicate it.

**`origin` is a discriminator, not a label.** `own` items carry a real `food.id`; `ciqual_ref` items
carry a `food_ref.id`, which is **not** a food id and must never be sent to an endpoint expecting
one. A client picking a `ciqual_ref` item adopts it first (`POST /foods/from-ref`) and continues
with the returned food. `locale` selects which name a reference entry is returned under, and which
name the duplicate rule compares — the same reason it exists on the reference catalog.

## Containers

- `GET /containers` — query `q`, `sort` ∈ {name,weight}, `dir`. The built-in
  "Rien" (0 g) is always present, listed first, locked. → 200 `{data:[Container]}`.
- `POST /containers` — `{name, empty_weight_g(≥0)}`. → 201.
- `PATCH /containers/:id` — 200 (404/409 if built-in "Rien").
- `DELETE /containers/:id` — 204. **Unrestricted** (history froze its own
  value; OPEN_GAPS #13). Deleting "Rien" → 409 `container_locked`.
