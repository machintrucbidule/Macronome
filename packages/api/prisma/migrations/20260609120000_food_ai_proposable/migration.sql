-- Add ai_proposable: foods are eligible for AI meal proposals by default. NOT NULL DEFAULT true
-- backfills every existing row to true (feature D9 / B-123). Additive & non-destructive.
ALTER TABLE "food" ADD COLUMN "ai_proposable" BOOLEAN NOT NULL DEFAULT true;
