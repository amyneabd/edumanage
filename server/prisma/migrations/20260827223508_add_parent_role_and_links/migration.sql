-- AlterTable
ALTER TABLE "PupilProfile" ADD COLUMN "parentCode" TEXT;

-- CreateTable
CREATE TABLE "ParentProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParentLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "pupilId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "ParentLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParentLink_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "PupilProfile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ParentLink_pupilId_status_idx" ON "ParentLink"("pupilId", "status");

-- CreateIndex
CREATE INDEX "ParentLink_teacherId_status_idx" ON "ParentLink"("teacherId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ParentLink_parentId_pupilId_key" ON "ParentLink"("parentId", "pupilId");

-- CreateIndex
CREATE UNIQUE INDEX "PupilProfile_parentCode_key" ON "PupilProfile"("parentCode");

