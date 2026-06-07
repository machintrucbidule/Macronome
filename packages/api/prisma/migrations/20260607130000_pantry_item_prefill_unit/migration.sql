-- GM-2 / B-092 — pantry prefill unit (spec/schema/tables-logging.md → pantry_item). A pin
-- remembers the unit a new day's qty-0 line is created with (g/ml/kg or a named portion).
-- Hand-written (like the other migrations) so the connect-pg-simple `session` table and the
-- unaccent/pg_trgm extensions stay untouched (docs/architecture/testing.md §5); Prisma's
-- auto-generated DROP TABLE "session" is intentionally omitted.
--
-- Additive & non-destructive: existing pins back-fill to unit='g' (DEFAULT) and a null
-- portion_id. Mirrors meal_entry: a unit CHECK and a portion_id FK that SET NULLs when the
-- named portion is deleted (prefill then falls back to g — logic/pantry-pin.md §3).

-- AlterTable
ALTER TABLE "pantry_item" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'g';
ALTER TABLE "pantry_item" ADD COLUMN "portion_id" UUID;

-- Contract CHECK constraint (spec/schema/tables-logging.md → pantry_item).
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_unit_check" CHECK ("unit" IN ('g', 'ml', 'kg', 'portion'));

-- portion_id FK (spec/schema/tables-logging.md): SET NULL on portion delete so the pin
-- survives a deleted named portion (prefill falls back to g).
ALTER TABLE "pantry_item" ADD CONSTRAINT "pantry_item_portion_id_fkey" FOREIGN KEY ("portion_id") REFERENCES "food_portion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
