-- B-198: per-line garde-manger pin. Reintroduce a per-line flag on meal_entry (the old
-- is_pinned was dropped by B-045). Display pins are derived as `pinned AND pantry_item
-- exists (slot, food)` (spec/logic/pantry-pin.md §2); a manually re-added duplicate is a
-- normal line (pinned=false by default). Hand-written (like the other migrations) so the
-- connect-pg-simple `session` table and the extensions stay untouched (Prisma's
-- auto-generated DROP TABLE "session" is intentionally omitted — testing.md §5).
--
-- Additive & non-destructive.

-- AlterTable
ALTER TABLE "meal_entry" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark every referenced line whose (user, slot, food) is currently pinned as a
-- garde-manger line, preserving the pre-B-198 display for existing data. New lines default
-- false. (For a food duplicated within a meal both lines get true here — we cannot tell the
-- placeholder from the duplicate retroactively; only NEW duplicates get the correct false.)
-- Implicit joins in FROM (the UPDATE target `me` cannot be referenced from a JOIN ... ON).
UPDATE "meal_entry" me
SET "pinned" = true
FROM "meal" m, "day_log" d, "pantry_item" pi
WHERE me."meal_id" = m."id"
  AND d."id" = m."day_log_id"
  AND pi."user_id" = d."user_id"
  AND pi."meal_slot_name" = m."slot_name"
  AND pi."food_id" = me."food_id"
  AND me."kind" = 'referenced'
  AND me."food_id" IS NOT NULL;
