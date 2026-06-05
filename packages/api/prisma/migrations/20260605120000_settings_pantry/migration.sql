-- M7 — settings & pantry (spec/schema/tables-logging.md → meal_slot_template,
-- pantry_item; indexes.md). Hand-written (like the M1–M5 migrations) so the
-- connect-pg-simple `session` table and the unaccent/pg_trgm extensions stay untouched
-- (docs/architecture/testing.md §5). Prisma's auto-generated DROP TABLE "session" is
-- intentionally omitted.
--
-- The `container` table already exists (added in the M3 daily-log migration for the
-- leftover endpoint); M7 only adds its diacritic-insensitive search index here (the
-- Contenants screen searches by normalized name). The locked built-in "Rien" container
-- is seeded as owner-scoped DATA, not DDL (services/user-bootstrap.ts), so it is not
-- inserted by this migration.

-- CreateTable
CREATE TABLE "meal_slot_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meal_slot_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pantry_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "meal_slot_name" TEXT NOT NULL,
    "food_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pantry_item_pkey" PRIMARY KEY ("id")
);

-- UNIQUE constraints (spec/schema/tables-logging.md): one slot name per user; one pin
-- per (user, meal slot, food) — the pantry dedup.
CREATE UNIQUE INDEX "meal_slot_template_user_id_name_key" ON "meal_slot_template"("user_id", "name");
CREATE UNIQUE INDEX "pantry_item_user_id_meal_slot_name_food_id_key" ON "pantry_item"("user_id", "meal_slot_name", "food_id");

-- Tenant & lookup indexes (spec/schema/indexes.md).
CREATE INDEX "idx_mealtemplate_user" ON "meal_slot_template"("user_id", "order_index");
CREATE INDEX "idx_pantry_user_meal" ON "pantry_item"("user_id", "meal_slot_name");

-- Diacritic-insensitive container search (spec/schema/indexes.md → idx_container_normname_trgm;
-- the Contenants screen searches by normalized name). The container table predates M7.
CREATE INDEX "idx_container_normname_trgm" ON "container" USING gin ("normalized_name" gin_trgm_ops);

-- Foreign keys (spec/schema/indexes.md §Referential cleanup). pantry_item.food_id RESTRICTs
-- against deleting a referenced food (foods are archived, never hard-deleted); both owner FKs
-- RESTRICT like every other user-owned table.
ALTER TABLE "meal_slot_template" ADD CONSTRAINT "meal_slot_template_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
