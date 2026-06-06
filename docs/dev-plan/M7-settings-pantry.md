# M7 — Settings & pantry

**Goal:** the account-menu surfaces — pantry pins, meal-slot templates, containers,
profile, language/theme, account — and the reserved (inert) LLM-endpoint config.
Depends-on: M1 (foods to pin), M3 (day pre-fill semantics).

## Scope

- `meal_slot_template`, `pantry_item` (`spec/schema/tables-logging.md`); `container`
  (`tables-catalog.md`) + built-in locked "Rien" (0 g).

> **Carried in from M3a (tracked):** the `container` table + a read-only `container.repo`
> already exist (M3a needed them for the leftover endpoint); M7 adds the **Contenants
> CRUD/screen**, the locked built-in **"Rien" seeding**, and `container.repo` writes — not
> the table DDL. The `meal_entry.is_pinned` column exists but is **inert** until M7 wires
> pantry pins. M3a materializes new days with a **default** slot set (`DEFAULT_MEAL_SLOTS`
> in `services/days.ts`); M7 must replace that with **meal_slot_template seeding +
> pantry_item pre-fill (qty 0)** and add the **pin/unpin endpoints**
> (`POST /meals/:mealId/entries/:id/pin` · `/unpin`, future-day effect only).

> **Carried in from M4 (tracked):** the Weight screen's **current mode (Régime/Maintien)**
> is **ephemeral / client-side in M4** — `GET /weight` returns `current_mode` (default = the
> latest period's `diet_flag`) and the screen toggles it in React state. **Persistence was
> deferred here** because the API contract defines **no write endpoint** for it: neither
> `/weight` nor the `/settings` DTO (`{locale, theme, llm_endpoint?}`) lists `current_mode`.
> M7 must take a **contract decision** (extend `/settings` to carry `current_mode`, or add a
> dedicated setter) then persist it on **`app_user.settings`** — which is already a
> `Json @default("{}")` column, so **no migration** is needed, only the endpoint. The
> projection's Maintien gate is applied client-side in M4 and should move server-side once
> the mode is persisted.

- Pantry editor (Gap 8, revised by B-045): pinned foods ordered by insertion; no
  duplicate pin per `(meal_slot_name, food_id)`. The pin is the **live source of truth**
  (icon derived per read on all days); **pinning** adds a qty-0 line to today + future
  days and prefills new days; **unpinning** drops qty-0 lines for (slot, food) everywhere
  and keeps qty > 0 (it loses only the icon) — see `spec/logic/pantry-pin.md`. Same op as
  the Repas 📌 toggle, seen from settings.
- Containers screen: CRUD; deletion is free (leftover history froze name+tare as a
  value, `DECISIONS.md` Gap 13) — "Rien" stays locked.
- Settings/profile/account screens (`specifications/screens/{settings,containers,
account}.md` + mockups): profile (sex, birthdate, height), language (i18n), theme,
  password change, and the reserved `User.settings.llm_endpoint` field (stored,
  unused — Gap 14a).

## Files (via `module-map.md`)

API: `services/{settings,pantry}.ts`, `data/repositories/{mealTemplate,pantry,
container}.repo.ts`, routes `http/routes/{settings,profile,mealTemplate,pantry}.ts` +
controllers. DTOs `shared/src/dto/{settings,container}.ts`.
Web: `features/{settings,containers,account}/`, `api/{settings,profile,mealTemplate,
pantry}.ts`, components `Form/`, `DataTable/`, `Modal/`, `states/`.

## Acceptance criteria

- **Integration** (`testing.md` §2): pin/unpin is idempotent per
  `(meal_slot_name, food_id)`; unpin does not mutate existing day lines; container
  delete leaves historical leftovers intact (name+tare frozen); profile update
  recomputes derived figures going forward; tenancy → 404; reserved `llm_endpoint`
  stored and round-trips, unused.
- **e2e (smoke):** pin a food → it pre-fills a new day's meal; unpin → future-only.

## Size check

Each settings sub-screen is its own small feature folder; no god-settings page.

## Split (approved): M7a backend, then M7b web

Too large for one pass (300-line rule), split like M3/M4/M5.

**M7a — backend DONE.** meal_slot_template + pantry_item tables + hand-written migration
(`20260605120000_settings_pantry`; container search index added here too); locked built-in
"Rien" seeded as owner data via `services/user-bootstrap.ts` (called by create-user + the
integration helper). Services/repos/routes/DTOs for settings, meal-template, pantry,
containers; the Repas 📌 `pin`/`unpin` endpoints (`services/pantry.ts`); day
scaffold/materialize rewired to seed from `meal_slot_template` + qty-0 garde-manger prefill
(`services/day-prefill.ts`, fallback to default slots). `current_mode` persisted on
`app_user.settings` and the projection's Maintien gate moved server-side
(`services/weight-view.ts`). Acceptance green: 10 integration cases (settings round-trip +
partial merge, current_mode→Weight view, meal-template CRUD, pantry dedup 409 + pin
idempotency + future-only prefill/unpin, container built-in lock + dup 409 + delete history
safety, tenancy 404) + typecheck + lint + check:schema (15 tables) + full unit/integration.

**M7b — web DONE.** `api/{settings,containers,mealTemplate,pantry,auth}.ts`; account-menu
dropdown in `AppShell` (Compte · Cibles · Contenants · Paramètres · logout; Cibles removed
from primary nav); `SettingsSync` applies persisted theme + locale on load (`applySettings`).
Screens: **Paramètres** (`features/settings/`: appearance theme tri-state + language, default
meal-template editor with reorder/rename/delete/add + per-meal garde-manger picker reusing
`Autocomplete`, inert AI placeholder), **Contenants** (`features/containers/`: toolbar +
sortable table with locked built-in first + add/edit modal + delete confirm), **Compte**
(`features/account/`: credentials card + password-change modal + logout). FR+EN i18n.
e2e green (`e2e/settings.spec.ts`): pin a food in Paramètres → it pre-fills a new day; unpin
→ future days no longer pre-fill. Acceptance green: typecheck + lint + web build + e2e.

### Deviations (M7a)

- **`current_mode` added to the `/settings` DTO** + stored on `app_user.settings`
  (user-approved deviation from the documented `{locale, theme, llm_endpoint?}`). Reuses the
  weigh-in `DietFlag`; `not_in_diet` is the Maintien mode that gates the projection. The spec
  is **not** edited (FIXED-contract rule); this note is the record. See `m4-current-mode-deferred`.
- **New error code `pantry_duplicate`** (`shared/errors.ts`) for the `POST /pantry` dedup; the
  📌 toggle is idempotent (no error). Container duplicate name → generic `conflict` (409);
  locked built-in edit/delete → `forbidden` (403).
- **`container` search index** (`idx_container_normname_trgm`) shipped in the M7 migration (the
  table predates M7; the index is needed by the Contenants search planned in M7b).

## Checklist

- [x] meal_slot_template + pantry_item tables + migration; locked "Rien" seeded (M7a)
- [x] pantry/settings/meal-template/containers services + repos + routes/controllers + DTOs (M7a)
- [x] Settings/Containers/Account screens; language/theme; reserved llm_endpoint; account menu (M7b)
- [x] persist Weight screen `current_mode` on `app_user.settings` + Maintien gate server-side (M7a)
- [x] integration: pin idempotency, future-only unpin, container-delete history safety, tenancy 404 (M7a)
- [x] acceptance: M7a integration cases green; future-only pre-fill e2e green (M7b)

> Note: profile (sex/birthdate/height) is **not** on Paramètres — it lives on Cibles
> (M2, `GET/PATCH /profile`), per `screens/account.md` v2.2. The reserved `llm_endpoint`
> round-trips through `/settings` (stored, unused); its UI is the inert AI placeholder.
