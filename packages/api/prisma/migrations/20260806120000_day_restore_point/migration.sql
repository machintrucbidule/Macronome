-- B-261 — day_restore_point: one undo point per day, written just before a destructive day
-- action (POST /days/:date/clear, /copy-from, DELETE /days/:date/meals/:mealId) and consumed
-- by POST /days/:date/undo. spec/schema/tables-logging.md §day_restore_point, indexes.md,
-- DECISIONS.md "STATE-1 / B-261". Hand-written like the other migrations (FK/index live here).

CREATE TABLE "day_restore_point" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    -- The day's full content in the day-copy plan shape: meals → entries (frozen macro snaps,
    -- per-line pantry flag) → leftover groups (frozen container name + tare), plus the day's
    -- kind/summary_kcal/comment/activity_level/verdict_override. A value snapshot, never refs.
    "payload" JSONB NOT NULL,
    -- Which action created the point: 'clear' | 'copy' | 'delete_meal'. Drives the toast copy.
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_restore_point_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "day_restore_point"
    ADD CONSTRAINT "day_restore_point_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;

-- At most one point per (user, date): each destructive action overwrites the previous one,
-- which is what makes undo single-level (spec/schema/indexes.md).
CREATE UNIQUE INDEX "uq_restorepoint_user_date" ON "day_restore_point"("user_id", "date");
