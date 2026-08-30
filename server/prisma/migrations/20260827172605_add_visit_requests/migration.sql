-- CreateTable
CREATE TABLE "VisitRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pupilId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sessionDate" DATETIME NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "VisitRequest_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "PupilProfile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisitRequest_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VisitRequest_classId_status_idx" ON "VisitRequest"("classId", "status");

-- CreateIndex
CREATE INDEX "VisitRequest_pupilId_idx" ON "VisitRequest"("pupilId");
