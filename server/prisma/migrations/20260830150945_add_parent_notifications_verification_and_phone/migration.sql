-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("body", "createdAt", "dedupeKey", "id", "link", "read", "teacherId", "title", "type") SELECT "body", "createdAt", "dedupeKey", "id", "link", "read", "teacherId", "title", "type" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE INDEX "Notification_teacherId_read_idx" ON "Notification"("teacherId", "read");
CREATE INDEX "Notification_parentId_read_idx" ON "Notification"("parentId", "read");
CREATE UNIQUE INDEX "Notification_teacherId_dedupeKey_key" ON "Notification"("teacherId", "dedupeKey");
CREATE UNIQUE INDEX "Notification_parentId_dedupeKey_key" ON "Notification"("parentId", "dedupeKey");
CREATE TABLE "new_PupilProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "requestedType" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT,
    "parentCode" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "parentPhone" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "PupilProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PupilProfile_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PupilProfile" ("classId", "parentCode", "requestedType", "teacherId", "userId") SELECT "classId", "parentCode", "requestedType", "teacherId", "userId" FROM "PupilProfile";
DROP TABLE "PupilProfile";
ALTER TABLE "new_PupilProfile" RENAME TO "PupilProfile";
CREATE UNIQUE INDEX "PupilProfile_parentCode_key" ON "PupilProfile"("parentCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
