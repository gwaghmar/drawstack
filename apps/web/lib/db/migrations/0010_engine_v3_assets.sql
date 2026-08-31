CREATE TABLE IF NOT EXISTS "engine_v3_asset" (
  "owner_key" text NOT NULL,
  "sha256" text NOT NULL,
  "metadata" jsonb NOT NULL,
  "content" bytea NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "engine_v3_asset_owner_sha_pk" PRIMARY KEY ("owner_key", "sha256"),
  CONSTRAINT "engine_v3_asset_sha256_chk" CHECK ("sha256" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS "engine_v3_asset_owner_created_idx" ON "engine_v3_asset" ("owner_key", "created_at" DESC);
ALTER TABLE "engine_v3_asset" ENABLE ROW LEVEL SECURITY;
