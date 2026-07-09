-- B-202 — advice: archived AI "Conseils" outputs (one row per generation of the `advice`
-- AI use). spec/schema/tables-catalog.md §advice, spec/logic/ai-advice.md, DECISIONS.md B-202.
-- Hand-written like the other migrations (FK/index live here, not in the Prisma model).

CREATE TABLE "advice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "advice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "advice"
    ADD CONSTRAINT "advice_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;

-- Conseils list order: a user's advices newest-first (spec/schema/indexes.md).
CREATE INDEX "idx_advice_user_created" ON "advice"("user_id", "created_at" DESC);
