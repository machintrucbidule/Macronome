-- B-190 — app_user gains the admin role and login/activity stamps
-- (spec/schema/tables-catalog.md §app_user, DECISIONS.md B-190/B-191).
-- Hand-written like the other migrations to leave the session table untouched.

ALTER TABLE "app_user" ADD COLUMN "is_admin" boolean NOT NULL DEFAULT false;
ALTER TABLE "app_user" ADD COLUMN "last_login_at" timestamptz;
ALTER TABLE "app_user" ADD COLUMN "last_seen_at" timestamptz;

-- Promote every account existing at upgrade time to admin (owner decision:
-- no multi-user instance exists yet — in practice exactly one owner).
UPDATE "app_user" SET "is_admin" = true;
