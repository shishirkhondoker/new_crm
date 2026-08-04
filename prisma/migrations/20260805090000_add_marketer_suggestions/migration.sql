CREATE TABLE IF NOT EXISTS "MarketerSuggestion" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketerSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketerSuggestion_recipientId_readAt_idx"
  ON "MarketerSuggestion"("recipientId", "readAt");

CREATE INDEX IF NOT EXISTS "MarketerSuggestion_senderId_idx"
  ON "MarketerSuggestion"("senderId");

ALTER TABLE "MarketerSuggestion" DROP CONSTRAINT IF EXISTS "MarketerSuggestion_senderId_fkey";
ALTER TABLE "MarketerSuggestion" DROP CONSTRAINT IF EXISTS "MarketerSuggestion_recipientId_fkey";

ALTER TABLE "MarketerSuggestion"
  ADD CONSTRAINT "MarketerSuggestion_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MarketerSuggestion_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
