-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('PUPIL_REQUEST', 'EXAM_SUBMISSION', 'PAYMENT_DUE', 'MONTHLY_RECAP', 'VISIT_REQUEST', 'SWAP_REQUEST', 'PARENT_REQUEST', 'POST_PUBLISHED', 'ABSENCE', 'SUBMISSION_MISSING');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SwapRequestStatus_new" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');
ALTER TABLE "public"."SwapRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SwapRequest" ALTER COLUMN "status" TYPE "SwapRequestStatus_new" USING ("status"::text::"SwapRequestStatus_new");
ALTER TYPE "SwapRequestStatus" RENAME TO "SwapRequestStatus_old";
ALTER TYPE "SwapRequestStatus_new" RENAME TO "SwapRequestStatus";
DROP TYPE "public"."SwapRequestStatus_old";
ALTER TABLE "SwapRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

