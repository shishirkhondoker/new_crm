-- Backfill legacy tasks before enforcing role-based assignment ownership.
UPDATE "Task"
SET "assignedById" = COALESCE(
  "assignedById",
  (
    SELECT "id"
    FROM "User"
    WHERE "role" IN ('ADMIN', 'SUPERVISOR')
      AND "status" = 'ACTIVE'
    ORDER BY
      CASE WHEN "role" = 'ADMIN' THEN 0 ELSE 1 END,
      "createdAt" ASC
    LIMIT 1
  ),
  (
    SELECT "id"
    FROM "User"
    ORDER BY "createdAt" ASC
    LIMIT 1
  )
)
WHERE "assignedById" IS NULL;

UPDATE "Task"
SET "assignedToId" = COALESCE(
  "assignedToId",
  (
    SELECT "id"
    FROM "User"
    WHERE "role" = 'MARKETER'
      AND "status" = 'ACTIVE'
    ORDER BY "createdAt" ASC
    LIMIT 1
  ),
  "assignedById",
  (
    SELECT "id"
    FROM "User"
    ORDER BY "createdAt" ASC
    LIMIT 1
  )
)
WHERE "assignedToId" IS NULL;

ALTER TABLE "Task"
  ALTER COLUMN "assignedById" SET NOT NULL,
  ALTER COLUMN "assignedToId" SET NOT NULL;
