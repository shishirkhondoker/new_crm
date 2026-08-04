CREATE TABLE IF NOT EXISTS "UserSupervisorAssignment" (
  "id" TEXT NOT NULL,
  "supervisorId" TEXT NOT NULL,
  "marketerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSupervisorAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserSupervisorAssignment_supervisorId_marketerId_key"
  ON "UserSupervisorAssignment"("supervisorId", "marketerId");

CREATE INDEX IF NOT EXISTS "UserSupervisorAssignment_supervisorId_idx"
  ON "UserSupervisorAssignment"("supervisorId");

CREATE INDEX IF NOT EXISTS "UserSupervisorAssignment_marketerId_idx"
  ON "UserSupervisorAssignment"("marketerId");

ALTER TABLE "UserSupervisorAssignment" DROP CONSTRAINT IF EXISTS "UserSupervisorAssignment_supervisorId_fkey";
ALTER TABLE "UserSupervisorAssignment" DROP CONSTRAINT IF EXISTS "UserSupervisorAssignment_marketerId_fkey";

ALTER TABLE "UserSupervisorAssignment"
  ADD CONSTRAINT "UserSupervisorAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserSupervisorAssignment_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserSupervisorAssignment" ("id", "supervisorId", "marketerId", "createdAt")
SELECT
  CONCAT('legacy-', marketer."id", '-', marketer."supervisorId"),
  marketer."supervisorId",
  marketer."id",
  CURRENT_TIMESTAMP
FROM "User" AS marketer
WHERE marketer."role" = 'MARKETER'
  AND marketer."supervisorId" IS NOT NULL
ON CONFLICT ("supervisorId", "marketerId") DO NOTHING;
