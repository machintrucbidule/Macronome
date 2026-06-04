-- M3 — daily log: container + day aggregate (spec/schema/tables-logging.md,
-- tables-catalog.md → container). Hand-written (like the M1/M2 migrations) so the
-- connect-pg-simple `session` table and the unaccent/pg_trgm extensions stay untouched
-- (docs/architecture/testing.md §5). Prisma's auto-generated DROP TABLE "session" is
-- intentionally omitted.
--
-- `container` is added here (ahead of its M7 Contenants screen) because the leftover
-- endpoint must resolve a container to FREEZE its name + tare_g at apply time. The full
-- Contenants CRUD/screen + built-in "Rien" seeding are built in M7; M3 only reads it.
-- `meal_slot_template` and `pantry_item` (also in tables-logging.md) are deferred to M7.

-- CreateTable
CREATE TABLE "container" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "empty_weight_g" DECIMAL NOT NULL,
    "is_builtin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "summary_kcal" DECIMAL,
    "activity_level" TEXT,
    "comment" TEXT,
    "verdict_auto" TEXT,
    "verdict_override" TEXT,
    "target_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "day_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "day_log_id" UUID NOT NULL,
    "slot_name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meal_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "food_id" UUID,
    "custom_name" TEXT,
    "served_quantity" DECIMAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "portion_id" UUID,
    "served_grams" DECIMAL,
    "snap_kcal" DECIMAL NOT NULL,
    "snap_fat" DECIMAL NOT NULL,
    "snap_carb" DECIMAL NOT NULL,
    "snap_protein" DECIMAL NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "meal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leftover_group" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meal_id" UUID NOT NULL,
    "container_name" TEXT NOT NULL,
    "tare_g" DECIMAL NOT NULL,
    "gross_grams" DECIMAL NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leftover_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leftover_group_entry" (
    "leftover_group_id" UUID NOT NULL,
    "meal_entry_id" UUID NOT NULL,

    CONSTRAINT "leftover_group_entry_pkey" PRIMARY KEY ("leftover_group_id", "meal_entry_id")
);

-- Contract CHECK constraints (spec/schema/tables-catalog.md → container).
ALTER TABLE "container" ADD CONSTRAINT "container_empty_weight_check" CHECK ("empty_weight_g" >= 0);

-- Contract CHECK constraints (spec/schema/tables-logging.md → day_log).
ALTER TABLE "day_log" ADD CONSTRAINT "day_log_kind_check" CHECK ("kind" IN ('detailed', 'summary'));
ALTER TABLE "day_log" ADD CONSTRAINT "day_log_summary_check" CHECK (("kind" = 'summary') = ("summary_kcal" IS NOT NULL));
ALTER TABLE "day_log" ADD CONSTRAINT "day_log_activity_check" CHECK ("activity_level" IS NULL OR "activity_level" IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'));
ALTER TABLE "day_log" ADD CONSTRAINT "day_log_verdict_auto_check" CHECK ("verdict_auto" IS NULL OR "verdict_auto" IN ('OK', 'NOK'));
ALTER TABLE "day_log" ADD CONSTRAINT "day_log_verdict_override_check" CHECK ("verdict_override" IS NULL OR "verdict_override" IN ('OK', 'NOK'));

-- Contract CHECK constraints (spec/schema/tables-logging.md → meal_entry).
ALTER TABLE "meal_entry" ADD CONSTRAINT "meal_entry_kind_check" CHECK ("kind" IN ('referenced', 'custom'));
ALTER TABLE "meal_entry" ADD CONSTRAINT "meal_entry_served_qty_check" CHECK ("served_quantity" >= 0);
ALTER TABLE "meal_entry" ADD CONSTRAINT "meal_entry_unit_check" CHECK ("unit" IN ('g', 'ml', 'kg', 'portion'));
ALTER TABLE "meal_entry" ADD CONSTRAINT "meal_entry_kind_ref_check" CHECK (("kind" = 'referenced' AND "food_id" IS NOT NULL) OR ("kind" = 'custom' AND "custom_name" IS NOT NULL));

-- Contract CHECK constraints (spec/schema/tables-logging.md → leftover_group).
ALTER TABLE "leftover_group" ADD CONSTRAINT "leftover_group_tare_check" CHECK ("tare_g" >= 0);
ALTER TABLE "leftover_group" ADD CONSTRAINT "leftover_group_gross_check" CHECK ("gross_grams" >= 0);

-- UNIQUE constraints: one container name per owner, one day per (user, date).
CREATE UNIQUE INDEX "container_owner_id_normalized_name_key" ON "container"("owner_id", "normalized_name");
CREATE UNIQUE INDEX "day_log_user_id_date_key" ON "day_log"("user_id", "date");

-- Tenant & lookup indexes (aggregate reads scope by parent then order_index).
CREATE INDEX "idx_container_owner" ON "container"("owner_id");
CREATE INDEX "idx_day_log_owner_date" ON "day_log"("user_id", "date");
CREATE INDEX "idx_meal_day" ON "meal"("day_log_id", "order_index");
CREATE INDEX "idx_meal_entry_meal" ON "meal_entry"("meal_id", "order_index");
CREATE INDEX "idx_leftover_group_meal" ON "leftover_group"("meal_id");
CREATE INDEX "idx_leftover_group_entry_entry" ON "leftover_group_entry"("meal_entry_id");

-- Foreign keys (no Prisma-level relations; the column-faithful schema mirrors the DDL
-- contract for the check:schema gate). Owner refs RESTRICT; the day aggregate cascades.
-- Referenced foods are soft-deleted (archived_at), never hard-deleted → RESTRICT is safe
-- and keeps kind='referenced' rows valid. A portion may be deleted on a food edit, so
-- portion_id is SET NULL (the served_grams + macro snapshot are already frozen).
ALTER TABLE "container" ADD CONSTRAINT "container_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "day_log" ADD CONSTRAINT "day_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meal" ADD CONSTRAINT "meal_day_log_id_fkey" FOREIGN KEY ("day_log_id") REFERENCES "day_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meal_entry" ADD CONSTRAINT "meal_entry_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meal_entry" ADD CONSTRAINT "meal_entry_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meal_entry" ADD CONSTRAINT "meal_entry_portion_id_fkey" FOREIGN KEY ("portion_id") REFERENCES "food_portion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leftover_group" ADD CONSTRAINT "leftover_group_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leftover_group_entry" ADD CONSTRAINT "leftover_group_entry_group_fkey" FOREIGN KEY ("leftover_group_id") REFERENCES "leftover_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leftover_group_entry" ADD CONSTRAINT "leftover_group_entry_entry_fkey" FOREIGN KEY ("meal_entry_id") REFERENCES "meal_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
