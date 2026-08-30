-- AlterTable
ALTER TABLE "Class" ADD COLUMN "monthlyFee" REAL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PaymentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pupilId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "amountDue" REAL,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentRecord_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "PupilProfile" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PaymentRecord" ("dueDate", "id", "paidAt", "period", "pupilId", "status", "updatedAt") SELECT "dueDate", "id", "paidAt", "period", "pupilId", "status", "updatedAt" FROM "PaymentRecord";
DROP TABLE "PaymentRecord";
ALTER TABLE "new_PaymentRecord" RENAME TO "PaymentRecord";
CREATE UNIQUE INDEX "PaymentRecord_pupilId_period_key" ON "PaymentRecord"("pupilId", "period");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
