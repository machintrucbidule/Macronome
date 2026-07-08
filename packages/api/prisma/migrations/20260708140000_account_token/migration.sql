-- B-193/B-194 — account_token: admin-generated single-use links (invitations +
-- password resets). spec/schema/tables-catalog.md §account_token, DECISIONS.md
-- B-193/B-194. Hand-written like the other migrations (FKs/CHECKs live here,
-- not in the Prisma model), leaving the session table untouched.

CREATE TABLE "account_token" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "account_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_token_token_hash_key" ON "account_token"("token_hash");

ALTER TABLE "account_token"
    ADD CONSTRAINT "account_token_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE;

ALTER TABLE "account_token"
    ADD CONSTRAINT "account_token_kind_check"
    CHECK ("kind" IN ('invite', 'password_reset'));

-- Invites are unbound; a password reset always targets an account.
ALTER TABLE "account_token"
    ADD CONSTRAINT "account_token_kind_user_check"
    CHECK (("kind" = 'invite' AND "user_id" IS NULL)
        OR ("kind" = 'password_reset' AND "user_id" IS NOT NULL));
