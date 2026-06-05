-- B-033 / B-038 — day_log.activity_level becomes NOT NULL DEFAULT 'sedentary'
-- (spec/schema/tables-logging.md, DECISIONS.md B-033/B-038). There is no longer an
-- "unset"/"Non définie" activity state: every day carries an activity level (default
-- sedentary). Hand-written (like the other M3 migrations) to leave the session table
-- and extensions untouched.

-- Backfill any existing NULL activity to the sedentary default before tightening.
UPDATE "day_log" SET "activity_level" = 'sedentary' WHERE "activity_level" IS NULL;

-- Replace the CHECK so it no longer permits NULL (it stays the 5 canonical keys).
ALTER TABLE "day_log" DROP CONSTRAINT "day_log_activity_check";
ALTER TABLE "day_log" ADD CONSTRAINT "day_log_activity_check" CHECK ("activity_level" IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'));

-- Default + NOT NULL.
ALTER TABLE "day_log" ALTER COLUMN "activity_level" SET DEFAULT 'sedentary';
ALTER TABLE "day_log" ALTER COLUMN "activity_level" SET NOT NULL;
