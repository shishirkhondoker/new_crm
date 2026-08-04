ALTER TABLE "CustomerCompany"
  ADD COLUMN IF NOT EXISTS "rawData" JSONB NOT NULL DEFAULT '{}'::jsonb;

