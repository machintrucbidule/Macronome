-- Extensions required by the schema contract (spec/schema/00-overview.md).
-- Used by diacritic-insensitive autocomplete in later milestones; created here so
-- every environment (incl. the test DB on migrate deploy) has them from the start.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "birthdate" DATE NOT NULL,
    "height_cm" DECIMAL NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_username_key" ON "app_user"("username");

-- Contract CHECK constraints (spec/schema/tables-catalog.md → app_user).
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_sex_check" CHECK ("sex" IN ('male', 'female'));
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_birthdate_check" CHECK ("birthdate" < CURRENT_DATE);
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_height_cm_check" CHECK ("height_cm" > 0);

-- Session store for connect-pg-simple (infra; not part of the DDL contract).
-- DDL from node_modules/connect-pg-simple/table.sql (OIDS clause dropped for PG17).
CREATE TABLE "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
