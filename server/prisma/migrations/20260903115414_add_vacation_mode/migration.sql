-- CreateEnum
CREATE TYPE "VacationStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "VacationPeriod" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "VacationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacationPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationSession" (
    "id" TEXT NOT NULL,
    "vacationPeriodId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "VacationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VacationPeriod_teacherId_status_idx" ON "VacationPeriod"("teacherId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VacationSession_classId_date_key" ON "VacationSession"("classId", "date");

-- CreateIndex
CREATE INDEX "VacationSession_vacationPeriodId_idx" ON "VacationSession"("vacationPeriodId");

-- AddForeignKey
ALTER TABLE "VacationPeriod" ADD CONSTRAINT "VacationPeriod_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationSession" ADD CONSTRAINT "VacationSession_vacationPeriodId_fkey" FOREIGN KEY ("vacationPeriodId") REFERENCES "VacationPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationSession" ADD CONSTRAINT "VacationSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
