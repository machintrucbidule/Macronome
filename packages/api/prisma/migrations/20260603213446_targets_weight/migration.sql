-- M2 — targets & weight (spec/schema/tables-weight-targets.md).
-- Hand-written (like the M1 _foods migration) so the connect-pg-simple `session` table
-- and the unaccent/pg_trgm extensions stay untouched: Prisma's diff would otherwise
-- DROP `session` (infra, not part of the DDL contract; docs/architecture/testing.md §5).
--
-- `weight_entry` is created here in M2 (ahead of its M4 home) so the metabolic engine
-- can read the current weight (latest weigh-in) needed for the macro floors, BMR and
-- the carb-ceiling warning. M4 builds periods/EMA/trajectory/the Weight screen on top
-- of this same table — no further DDL for the table itself.

-- CreateTable
CREATE TABLE "target" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "calorie_min" INTEGER NOT NULL,
    "calorie_max" INTEGER NOT NULL,
    "protein_g_per_kg" DECIMAL NOT NULL,
    "fat_g_per_kg" DECIMAL NOT NULL,
    "target_weight_kg" DECIMAL,
    "rate_kg_per_week" DECIMAL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "weight_kg" DECIMAL NOT NULL,
    "waist_cm" DECIMAL,
    "diet_flag" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "weight_entry_pkey" PRIMARY KEY ("id")
);

-- Contract CHECK constraints (spec/schema/tables-weight-targets.md → target).
ALTER TABLE "target" ADD CONSTRAINT "target_calorie_min_check" CHECK ("calorie_min" > 0);
ALTER TABLE "target" ADD CONSTRAINT "target_calorie_max_check" CHECK ("calorie_max" >= "calorie_min");
ALTER TABLE "target" ADD CONSTRAINT "target_protein_check" CHECK ("protein_g_per_kg" >= 0);
ALTER TABLE "target" ADD CONSTRAINT "target_fat_check" CHECK ("fat_g_per_kg" >= 0);
ALTER TABLE "target" ADD CONSTRAINT "target_weight_check" CHECK ("target_weight_kg" IS NULL OR "target_weight_kg" > 0);
ALTER TABLE "target" ADD CONSTRAINT "target_rate_check" CHECK ("rate_kg_per_week" IS NULL OR "rate_kg_per_week" >= 0);

-- Contract CHECK constraints (spec/schema/tables-weight-targets.md → weight_entry).
ALTER TABLE "weight_entry" ADD CONSTRAINT "weight_entry_weight_check" CHECK ("weight_kg" > 0);
ALTER TABLE "weight_entry" ADD CONSTRAINT "weight_entry_waist_check" CHECK ("waist_cm" IS NULL OR "waist_cm" > 0);
ALTER TABLE "weight_entry" ADD CONSTRAINT "weight_entry_diet_flag_check" CHECK ("diet_flag" IN ('in_diet', 'not_in_diet'));

-- UNIQUE constraints: one target per effective_from, one weigh-in per day.
CREATE UNIQUE INDEX "target_user_id_effective_from_key" ON "target"("user_id", "effective_from");
CREATE UNIQUE INDEX "weight_entry_user_id_date_key" ON "weight_entry"("user_id", "date");

-- Tenant & lookup indexes (latest-as-of reads scope by user then order by date/from).
CREATE INDEX "idx_target_owner_effective" ON "target"("user_id", "effective_from");
CREATE INDEX "idx_weight_owner_date" ON "weight_entry"("user_id", "date");

-- Foreign keys (no Prisma-level relations; the column-faithful schema mirrors the DDL
-- contract for the check:schema gate).
ALTER TABLE "target" ADD CONSTRAINT "target_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "weight_entry" ADD CONSTRAINT "weight_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
