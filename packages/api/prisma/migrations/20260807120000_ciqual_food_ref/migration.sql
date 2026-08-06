-- B-289, B-290 (CIQ-1) — the global Ciqual reference catalog, and a real `food.source`
-- vocabulary. spec/schema/tables-catalog.md §food_ref + §food, spec/schema/indexes.md,
-- spec/logic/ciqual-catalog.md, DECISIONS.md "CIQ-1 / B-289, B-290".
-- Hand-written like the other migrations (constraints/indexes live here, not in Prisma).

-- 1. The reference catalog. NOT user data: no owner_id, no FK to app_user, never exported,
-- never wiped. Written only by the boot seeder, which replaces the whole table when the
-- shipped `dataset` marker differs from the stored one.
CREATE TABLE "food_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    -- Edition marker, e.g. 'ciqual_2025'. Drives the idempotent re-seed on upgrade.
    "dataset" TEXT NOT NULL,
    -- The source table's food code (Ciqual `alim_code`), kept as TEXT: it is zero-padded.
    "code" TEXT NOT NULL,
    "name_fr" TEXT NOT NULL,
    "name_eng" TEXT NOT NULL,
    -- unaccent+lower, computed at seed time with the same normalize() as food.normalized_name,
    -- so a reference entry and a user's food compare byte-for-byte.
    "normalized_name_fr" TEXT NOT NULL,
    "normalized_name_eng" TEXT NOT NULL,
    -- Level-1 Ciqual food group only; sub-groups are not stored.
    "group_label_fr" TEXT NOT NULL,
    "group_label_eng" TEXT NOT NULL,
    "kcal_per_100g" DECIMAL NOT NULL,
    "fat_per_100g" DECIMAL NOT NULL,
    "carb_per_100g" DECIMAL NOT NULL,
    "protein_per_100g" DECIMAL NOT NULL,
    -- true when kcal was derived from the macros rather than published
    -- (spec/logic/ciqual-catalog.md §4.2).
    "energy_derived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_ref_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "food_ref" ADD CONSTRAINT "food_ref_kcal_check" CHECK ("kcal_per_100g" >= 0);
ALTER TABLE "food_ref" ADD CONSTRAINT "food_ref_fat_check" CHECK ("fat_per_100g" >= 0);
ALTER TABLE "food_ref" ADD CONSTRAINT "food_ref_carb_check" CHECK ("carb_per_100g" >= 0);
ALTER TABLE "food_ref" ADD CONSTRAINT "food_ref_protein_check" CHECK ("protein_per_100g" >= 0);

-- One row per food per edition.
CREATE UNIQUE INDEX "uq_foodref_dataset_code" ON "food_ref"("dataset", "code");
-- The catalog is searched over BOTH names at once (one query matches "pomme" and "apple").
CREATE INDEX "idx_foodref_normname_fr_trgm" ON "food_ref" USING gin ("normalized_name_fr" gin_trgm_ops);
CREATE INDEX "idx_foodref_normname_eng_trgm" ON "food_ref" USING gin ("normalized_name_eng" gin_trgm_ops);
-- Group filter in the catalog view.
CREATE INDEX "idx_foodref_dataset_group" ON "food_ref"("dataset", "group_label_fr");

-- 2. food.source becomes a real vocabulary (B-290). 'imported' was reserved in the original
-- contract and never written by anything; 'ciqual' (adopted from food_ref) and 'chronodrive'
-- (created from a Chronodrive product prefill) replace it. Defensive UPDATE first: expected
-- to touch 0 rows, but the CHECK swap below would fail hard on any that exist.
UPDATE "food" SET "source" = 'manual' WHERE "source" = 'imported';

ALTER TABLE "food" DROP CONSTRAINT "food_source_check";
ALTER TABLE "food" ADD CONSTRAINT "food_source_check"
    CHECK ("source" IN ('manual', 'recipe', 'ciqual', 'chronodrive'));
