-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PupilProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "requestedType" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT,
    "parentCode" TEXT NOT NULL,
    CONSTRAINT "PupilProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PupilProfile_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PupilProfile" ("classId", "parentCode", "requestedType", "teacherId", "userId") SELECT "classId", "parentCode", "requestedType", "teacherId", "userId" FROM "PupilProfile";
DROP TABLE "PupilProfile";
ALTER TABLE "new_PupilProfile" RENAME TO "PupilProfile";
CREATE UNIQUE INDEX "PupilProfile_parentCode_key" ON "PupilProfile"("parentCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

