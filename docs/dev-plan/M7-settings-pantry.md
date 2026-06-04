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

- Pantry editor (Gap 8): pinned foods ordered by insertion; no duplicate pin per
  `(meal_slot_name, food_id)`; **unpinning affects future-day pre-fill only** —
  today's/past lines untouched. Same op as the Repas 📌 toggle, seen from settings.
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

## Checklist

- [ ] meal_slot_template + pantry_item + container tables + migration; locked "Rien"
- [ ] pantry/settings services + repos + routes/controllers + DTOs
- [ ] Settings/Containers/Account screens; profile; language/theme; reserved llm_endpoint
- [ ] persist Weight screen `current_mode` on `app_user.settings` (deferred from M4; needs a
      contract decision on the write endpoint — see the M4 carry-in note above); then move the
      projection's Maintien gate server-side
- [ ] integration: pin idempotency, future-only unpin, container-delete history safety, tenancy 404
- acceptance: listed integration cases green; future-only pre-fill e2e green
