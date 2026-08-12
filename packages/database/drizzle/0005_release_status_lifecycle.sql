-- Correct databases that recorded 0004 before its release-status conversion
-- was introduced. Installment status is factual; title lifecycle is calculated
-- by the API from all of a title's installments.
ALTER TYPE "release_status" RENAME TO "release_status_legacy";
--> statement-breakpoint
CREATE TYPE "release_status" AS ENUM ('announced', 'airing', 'completed', 'unknown');
--> statement-breakpoint
ALTER TABLE "installments" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "installments" ALTER COLUMN "status" TYPE "release_status"
USING (
  CASE "status"::text
    WHEN 'releasing' THEN 'airing'
    WHEN 'released' THEN 'completed'
    WHEN 'ended' THEN 'completed'
    ELSE "status"::text
  END
)::"release_status";
--> statement-breakpoint
ALTER TABLE "installments" ALTER COLUMN "status" SET DEFAULT 'unknown';
--> statement-breakpoint
DROP TYPE "release_status_legacy";
