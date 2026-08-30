-- AlterTable
ALTER TABLE "Post" ADD COLUMN "maxGrade" REAL;

-- AlterTable
ALTER TABLE "PostSubmission" ADD COLUMN "feedback" TEXT;
ALTER TABLE "PostSubmission" ADD COLUMN "grade" REAL;
ALTER TABLE "PostSubmission" ADD COLUMN "gradedAt" DATETIME;
