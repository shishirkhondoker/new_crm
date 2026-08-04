ALTER TABLE "User"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "firstLogin" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "passwordNotSet" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "authSetupToken" TEXT,
ADD COLUMN "authSetupPurpose" TEXT,
ADD COLUMN "authSetupExpiresAt" TIMESTAMP(3);

ALTER TABLE "OTP"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'LOGIN';

CREATE UNIQUE INDEX "User_authSetupToken_key" ON "User"("authSetupToken");
