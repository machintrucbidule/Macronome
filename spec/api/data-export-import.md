# API — data management (export / wipe / import)

See `00-conventions.md`. Scoped to the authenticated user. Base path `/api/v1/data`.

This is the user-facing **account data round-trip** (IMP-1): a self-hosted owner can take a
portable backup, restore it, or reset their account. It is **distinct from O1** (the one-shot
Excel → DB ETL in `packages/etl`, out of the dev plan): O1 imports a spreadsheet; this round-trips
Macronome's own extract format. Credentials are never exported, imported, or wiped.

## Preserved "seed" (never wiped or overwritten by these endpoints)

The owner `app_user` **identity** (username + password hash) is never touched. Beyond that:

- **Wipe** keeps the account's structural seed too: the `meal_slot_template` rows and the locked
  built-in `container` "Rien" (so the account stays usable). It clears everything else.
- **Import** (restore) clears the structural seed as well and **restores it from the extract**
  (which contains it), and overwrites the profile (`sex`, `birthdate`, `height_cm`) + `settings`
  blob — but **never the credentials**. A defensive re-seed guarantees a built-in "Rien" exists
  afterwards.

## Endpoints

- `GET /data/export` — full account snapshot as a **downloadable JSON file**
  (`Content-Type: application/json`, `Content-Disposition: attachment;
filename="macronome-export-YYYY-MM-DD.json"`). Body = the **envelope** below (not the
  `{data}` wrapper — the file _is_ the envelope). → 200; 404 if the user is absent.
- `POST /data/wipe` — delete all tracked data, keep the seed (B-001). → 200 `{data:{ok:true}}`.
  Strong typed confirmation is enforced **client-side** (`design/components/modals.md`), as for
  every destructive flow; the endpoint itself is unguarded beyond auth + CSRF.
- `POST /data/import` — body = an export envelope. **REPLACE / restore semantics**: in one
  transaction it wipes all tracked data (structure included) and re-inserts the extract verbatim,
  re-pointing owner/user columns at the current account and **carrying frozen snapshots across
  unchanged** (`snap_*`, `day_log.target_snapshot`, `leftover_group` container values). Original
  row ids are preserved (the account was just wiped, so there is no collision; the same file
  therefore also restores into a fresh install). → 200 `{data:{ok:true}}`.
  - Malformed envelope (shape) → **422 `import_invalid_format`** (per-field `details`).
  - `format_version` the server does not support → **422 `import_unsupported_version`**
    `{format_version}`.
  - A referentially broken (hand-edited) envelope that violates a DB constraint →
    **422 `import_invalid_format`** `{db_code}` (translated from the DB error, not a 500).

Both POSTs require the CSRF header (state-changing). The import body may be large; the JSON body
limit is raised accordingly server-side.

## Envelope format (`format_version: 1`)

A single JSON object. Keys are `snake_case` mirroring the data-schema contract; Decimal columns
travel as JSON **numbers**, `DATE` columns as `YYYY-MM-DD`, instants as ISO-8601. `created_at` is
preserved per row; `updated_at` is regenerated on import. Credentials are absent.

```jsonc
{
  "format_version": 1,
  "exported_at": "<ISO-8601>",
  "profile": { "sex", "birthdate", "height_cm" },
  "settings": { /* the app_user.settings blob, verbatim */ },
  "meal_templates":   [ { "id","name","order_index","created_at" } ],
  "containers":       [ { "id","name","normalized_name","empty_weight_g","is_builtin","created_at" } ],
  "foods":            [ { "id","name","normalized_name","kcal_per_100g","fat_per_100g","carb_per_100g","protein_per_100g","comment","rating","visibility","source","recipe_id","archived_at","created_at" } ],
  "food_portions":    [ { "id","food_id","label","grams","created_at" } ],
  "recipes":          [ { "id","name","normalized_name","instructions","total_batch_grams","servings","rating","archived_at","created_at" } ],
  "recipe_ingredients":[ { "id","recipe_id","ref_type","ref_food_id","ref_recipe_id","quantity","unit","portion_id","order_index" } ],
  "pantry_items":     [ { "id","meal_slot_name","food_id","order_index","created_at" } ],
  "weight_entries":   [ { "id","date","weight_kg","waist_cm","diet_flag","note","created_at" } ],
  "targets":          [ { "id","calorie_min","calorie_max","protein_g_per_kg","fat_g_per_kg","target_weight_kg","rate_kg_per_week","effective_from","created_at" } ],
  "day_logs":         [ { "id","date","kind","summary_kcal","activity_level","comment","verdict_auto","verdict_override","target_snapshot","created_at" } ],
  "meals":            [ { "id","day_log_id","slot_name","order_index","created_at" } ],
  "meal_entries":     [ { "id","meal_id","kind","food_id","custom_name","served_quantity","unit","portion_id","served_grams","snap_kcal","snap_fat","snap_carb","snap_protein","order_index","created_at" } ],
  "leftover_groups":  [ { "id","meal_id","container_name","tare_g","gross_grams","created_at" } ],
  "leftover_group_entries": [ { "leftover_group_id","meal_entry_id" } ]
}
```

Recipe-derived foods (`source='recipe'`, `recipe_id` → recipe) are ordinary `foods` rows in the
envelope; on import recipes are inserted before foods so the derived link resolves.
