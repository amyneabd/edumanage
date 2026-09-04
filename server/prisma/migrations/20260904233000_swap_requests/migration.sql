-- Drop VisitRequest table
DROP TABLE IF EXISTS "VisitRequest" CASCADE;

-- Step: Add EXCUSED to AttendanceStatus enum
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'EXCUSED';

-- Step: Add new values to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SWAP_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VACATION_SESSION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ENROLLMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ENROLLMENT_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PUPIL_REGISTERED';

-- Step: Drop old VisitRequestStatus and create SwapRequestStatus
DROP TYPE IF EXISTS "VisitRequestStatus";
DROP TYPE IF EXISTS "SwapRequestStatus";
CREATE TYPE "SwapRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- Create SwapRequest table
CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "pupilId" TEXT NOT NULL,
    "originClassId" TEXT NOT NULL,
    "originDate" TIMESTAMP(3) NOT NULL,
    "targetClassId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "SwapRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- Create indexes for SwapRequest
CREATE INDEX "SwapRequest_pupilId_idx" ON "SwapRequest"("pupilId");
CREATE INDEX "SwapRequest_originClassId_idx" ON "SwapRequest"("originClassId");
CREATE INDEX "SwapRequest_targetClassId_idx" ON "SwapRequest"("targetClassId");

-- Add foreign key constraints for SwapRequest
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "PupilProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_originClassId_fkey" FOREIGN KEY ("originClassId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_targetClassId_fkey" FOREIGN KEY ("targetClassId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
