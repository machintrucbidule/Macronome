-- M5 — recipes & derived food (spec/schema/tables-catalog.md → recipe,
-- recipe_ingredient; indexes.md). Hand-written (like the M1–M3 migrations) so the
-- connect-pg-simple `session` table and the unaccent/pg_trgm extensions stay untouched
-- (docs/architecture/testing.md §5). Prisma's auto-generated DROP TABLE "session" is
-- intentionally omitted.
--
-- This migration also adds the M1-deferred FK food.recipe_id → recipe(id): the column
-- already exists (plain nullable Uuid from the foods migration); it is set when
-- source='recipe' (the derived food a recipe (re)builds).

-- CreateTable
CREATE TABLE "recipe" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "instructions" TEXT,
    "total_batch_grams" DECIMAL NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable (no created_at/updated_at — not in the contract for this table)
CREATE TABLE "recipe_ingredient" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipe_id" UUID NOT NULL,
    "ref_type" TEXT NOT NULL,
    "ref_food_id" UUID,
    "ref_recipe_id" UUID,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "portion_id" UUID,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "recipe_ingredient_pkey" PRIMARY KEY ("id")
);

-- Contract CHECK constraints (spec/schema/tables-catalog.md → recipe).
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_batch_check" CHECK ("total_batch_grams" > 0);
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_servings_check" CHECK ("servings" >= 1);

-- Contract CHECK constraints (spec/schema/tables-catalog.md → recipe_ingredient).
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_ref_type_check" CHECK ("ref_type" IN ('food', 'recipe'));
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_unit_check" CHECK ("unit" IN ('g', 'ml', 'kg', 'portion'));
-- XOR: a food ingredient carries ref_food_id (and no ref_recipe_id), and vice versa.
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_ref_xor_check" CHECK (("ref_type" = 'food' AND "ref_food_id" IS NOT NULL AND "ref_recipe_id" IS NULL) OR ("ref_type" = 'recipe' AND "ref_recipe_id" IS NOT NULL AND "ref_food_id" IS NULL));
-- No direct self-reference; transitive cycles are blocked in app logic.
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_self_ref_check" CHECK ("ref_recipe_id" <> "recipe_id");

-- Diacritic-insensitive autocomplete: GIN trigram index on the normalized key.
CREATE INDEX "idx_recipe_normname_trgm" ON "recipe" USING gin ("normalized_name" gin_trgm_ops);

-- Tenant & lookup indexes (active rows only; archived recipes drop out of search).
CREATE INDEX "idx_recipe_owner" ON "recipe"("owner_id") WHERE "archived_at" IS NULL;
CREATE INDEX "idx_recipe_owner_normname" ON "recipe"("owner_id", "normalized_name") WHERE "archived_at" IS NULL;
CREATE INDEX "idx_recipe_ingredient_recipe" ON "recipe_ingredient"("recipe_id", "order_index");

-- Foreign keys (no Prisma-level relations; the column-faithful schema mirrors the DDL
-- contract for the check:schema gate). Owner refs RESTRICT; ingredients cascade from the
-- recipe. Referenced foods/recipes are soft-deleted (archived_at), never hard-deleted →
-- RESTRICT is safe. A portion may be deleted on a food edit, so portion_id is SET NULL.
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_ref_food_id_fkey" FOREIGN KEY ("ref_food_id") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_ref_recipe_id_fkey" FOREIGN KEY ("ref_recipe_id") REFERENCES "recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_portion_id_fkey" FOREIGN KEY ("portion_id") REFERENCES "food_portion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- M1-deferred FK: the derived food points back to its recipe (set when source='recipe').
ALTER TABLE "food" ADD CONSTRAINT "food_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
