-- RT-1 / B-080 — recipe rating (spec/schema/tables-catalog.md → recipe). Mirrors
-- food.rating: null=unrated, else a 0..3 grade. Hand-written (like the other migrations)
-- so the connect-pg-simple `session` table and the unaccent/pg_trgm extensions stay
-- untouched (docs/architecture/testing.md §5); Prisma's auto-generated DROP TABLE
-- "session" is intentionally omitted.

-- AlterTable
ALTER TABLE "recipe" ADD COLUMN "rating" SMALLINT;

-- Contract CHECK constraint (spec/schema/tables-catalog.md → recipe).
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_rating_check" CHECK ("rating" IS NULL OR "rating" IN (0, 1, 2, 3));
