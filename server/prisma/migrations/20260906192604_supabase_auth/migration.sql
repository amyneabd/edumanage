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
