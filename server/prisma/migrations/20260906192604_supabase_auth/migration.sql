-- Wipe existing User rows: pre-migration accounts used password hashes with no
-- way to derive a Supabase Auth supabaseId, and this is dev/test data only.
TRUNCATE TABLE "User" CASCADE;

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "EmailVerificationToken" DROP CONSTRAINT "EmailVerificationToken_userId_fkey";

-- DropTable
DROP TABLE "PasswordResetToken";

-- DropTable
DROP TABLE "EmailVerificationToken";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash",
DROP COLUMN "emailVerifiedAt",
ADD COLUMN "supabaseId" TEXT NOT NULL UNIQUE;
