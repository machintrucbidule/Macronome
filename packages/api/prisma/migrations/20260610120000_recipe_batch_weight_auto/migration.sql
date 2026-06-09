-- RW-1 / B-137 — persisted auto batch-weight flag (spec/schema/tables-catalog.md → recipe).
-- true ⇒ the server keeps total_batch_grams = Σ ingredient grams on every save/rebuild.
-- Hand-written (like the other migrations) so the connect-pg-simple `session` table and
-- the unaccent/pg_trgm extensions stay untouched (docs/architecture/testing.md §5).

-- AlterTable
ALTER TABLE "recipe" ADD COLUMN "batch_weight_auto" BOOLEAN NOT NULL DEFAULT false;

-- Backfill (user decision, DECISIONS.md RW-1): a recipe whose stored batch weight equals
-- its current ingredient sum was never customised → flip it to auto so it re-tracks the
-- sum (fixes B-137 retroactively); a deliberate cooked weight (≠ Σ) stays manual.
-- Gram resolution mirrors domain/serving resolveServedGrams: g/ml → quantity (1 ml = 1 g),
-- kg → ×1000, portion → quantity × food_portion.grams (the derived food's portions for
-- recipe-type ingredients, same food_portion table). Tolerance 0.01 g absorbs float noise
-- from the JS-summed value persisted at save time.
UPDATE "recipe" r
SET "batch_weight_auto" = true
WHERE abs(
  r."total_batch_grams" - COALESCE((
    SELECT SUM(
      CASE ri."unit"
        WHEN 'g' THEN ri."quantity"
        WHEN 'ml' THEN ri."quantity"
        WHEN 'kg' THEN ri."quantity" * 1000
        WHEN 'portion' THEN ri."quantity" * fp."grams"
      END
    )
    FROM "recipe_ingredient" ri
    LEFT JOIN "food_portion" fp ON fp."id" = ri."portion_id"
    WHERE ri."recipe_id" = r."id"
  ), 0)
) < 0.01;
