ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "taskDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isPrevious" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "companyName" TEXT,
  ADD COLUMN IF NOT EXISTS "leadName" TEXT,
  ADD COLUMN IF NOT EXISTS "completedById" TEXT,
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

UPDATE "Task"
SET "taskDate" = COALESCE("taskTime", "dueDate", "createdAt", CURRENT_TIMESTAMP)
WHERE "taskDate" IS NULL;

UPDATE "Task"
SET "isPrevious" = false
WHERE "isPrevious" IS NULL;

UPDATE "Task" AS "task"
SET "companyName" = "company"."name"
FROM "CustomerCompany" AS "company"
WHERE "task"."companyId" = "company"."id"
  AND "task"."companyName" IS NULL;

UPDATE "Task" AS "task"
SET "leadName" = COALESCE("lead"."customerName", "lead"."title")
FROM "Lead" AS "lead"
WHERE "task"."leadId" = "lead"."id"
  AND "task"."leadName" IS NULL;

ALTER TABLE "Task"
  ALTER COLUMN "taskDate" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "taskDate" SET NOT NULL,
  ALTER COLUMN "isPrevious" SET DEFAULT false,
  ALTER COLUMN "isPrevious" SET NOT NULL,
  ALTER COLUMN "assignedById" SET NOT NULL,
  ALTER COLUMN "assignedToId" SET NOT NULL;

ALTER TABLE "FollowUp"
  ADD COLUMN IF NOT EXISTS "priority" "Priority",
  ADD COLUMN IF NOT EXISTS "rating" INTEGER,
  ADD COLUMN IF NOT EXISTS "taskId" TEXT;

UPDATE "FollowUp"
SET "priority" = 'MEDIUM'
WHERE "priority" IS NULL;

ALTER TABLE "FollowUp"
  ALTER COLUMN "priority" SET DEFAULT 'MEDIUM',
  ALTER COLUMN "priority" SET NOT NULL;

ALTER TABLE "CommunicationLog"
  ADD COLUMN IF NOT EXISTS "taskId" TEXT,
  ADD COLUMN IF NOT EXISTS "discussionTopic" TEXT,
  ADD COLUMN IF NOT EXISTS "productDiscussed" TEXT;

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assignedById_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assignedToId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_completedById_fkey";
ALTER TABLE "FollowUp" DROP CONSTRAINT IF EXISTS "FollowUp_taskId_fkey";
ALTER TABLE "CommunicationLog" DROP CONSTRAINT IF EXISTS "CommunicationLog_taskId_fkey";

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FollowUp"
  ADD CONSTRAINT "FollowUp_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunicationLog"
  ADD CONSTRAINT "CommunicationLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Task_status_taskDate_idx" ON "Task"("status", "taskDate");
CREATE INDEX IF NOT EXISTS "Task_assignedToId_taskDate_idx" ON "Task"("assignedToId", "taskDate");
