-- M1 — foods catalog (spec/schema/tables-catalog.md, indexes.md).
-- Note: the connect-pg-simple `session` table and the unaccent/pg_trgm extensions
-- are created in the init migration and intentionally live in SQL, not schema.prisma
-- (docs/architecture/testing.md §5). Prisma's auto-generated DROP TABLE "session"
-- has been removed here on purpose.

-- CreateTable
CREATE TABLE "food" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "kcal_per_100g" DECIMAL NOT NULL,
    "fat_per_100g" DECIMAL NOT NULL,
    "carb_per_100g" DECIMAL NOT NULL,
    "protein_per_100g" DECIMAL NOT NULL,
    "comment" TEXT,
    "rating" SMALLINT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "recipe_id" UUID,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_portion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "food_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "grams" DECIMAL NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "food_portion_pkey" PRIMARY KEY ("id")
);

-- Contract CHECK constraints (spec/schema/tables-catalog.md → food / food_portion).
ALTER TABLE "food" ADD CONSTRAINT "food_kcal_check" CHECK ("kcal_per_100g" >= 0);
ALTER TABLE "food" ADD CONSTRAINT "food_fat_check" CHECK ("fat_per_100g" >= 0);
ALTER TABLE "food" ADD CONSTRAINT "food_carb_check" CHECK ("carb_per_100g" >= 0);
ALTER TABLE "food" ADD CONSTRAINT "food_protein_check" CHECK ("protein_per_100g" >= 0);
ALTER TABLE "food" ADD CONSTRAINT "food_rating_check" CHECK ("rating" IS NULL OR "rating" IN (0, 1, 2, 3));
ALTER TABLE "food" ADD CONSTRAINT "food_visibility_check" CHECK ("visibility" IN ('private', 'shared'));
ALTER TABLE "food" ADD CONSTRAINT "food_source_check" CHECK ("source" IN ('manual', 'recipe', 'imported'));
ALTER TABLE "food_portion" ADD CONSTRAINT "food_portion_grams_check" CHECK ("grams" > 0);

-- UNIQUE (food_id, label) — labels unique per food.
CREATE UNIQUE INDEX "food_portion_food_id_label_key" ON "food_portion"("food_id", "label");

-- Diacritic-insensitive autocomplete: GIN trigram index on the normalized key
-- (extensions created in the init migration).
CREATE INDEX "idx_food_normname_trgm" ON "food" USING gin ("normalized_name" gin_trgm_ops);

-- Tenant & lookup indexes (active rows only; archived foods drop out of search).
CREATE INDEX "idx_food_owner" ON "food"("owner_id") WHERE "archived_at" IS NULL;
CREATE INDEX "idx_food_owner_normname" ON "food"("owner_id", "normalized_name") WHERE "archived_at" IS NULL;

-- Foreign keys (no Prisma-level relations; the column-faithful schema mirrors the
-- DDL contract for the check:schema gate). The recipe_id FK is added in M5 with the
-- recipe table.
ALTER TABLE "food" ADD CONSTRAINT "food_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "food_portion" ADD CONSTRAINT "food_portion_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "food"("id") ON DELETE CASCADE ON UPDATE CASCADE;
