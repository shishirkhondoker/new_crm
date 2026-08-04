ALTER TABLE "CustomerCompany"
  ADD COLUMN IF NOT EXISTS "isParked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "parkedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "parkedNote" TEXT,
  ADD COLUMN IF NOT EXISTS "parkedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "parkedById" TEXT;

CREATE INDEX IF NOT EXISTS "CustomerCompany_isParked_idx" ON "CustomerCompany"("isParked");

ALTER TABLE "CustomerCompany" DROP CONSTRAINT IF EXISTS "CustomerCompany_parkedById_fkey";

ALTER TABLE "CustomerCompany"
  ADD CONSTRAINT "CustomerCompany_parkedById_fkey" FOREIGN KEY ("parkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COLD_CUSTOMER_DUE';
