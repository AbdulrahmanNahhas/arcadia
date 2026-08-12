-- Replace the old mixed title/installment statuses with factual installment
-- states. The calculated title lifecycle lives in the API and is never stored.
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
--> statement-breakpoint
DELETE FROM "title_aliases" AS duplicate
USING (
  SELECT id,
    row_number() OVER (
      PARTITION BY title_id, lower(btrim(title))
      ORDER BY is_preferred DESC, language NULLS LAST, id
    ) AS row_number
  FROM "title_aliases"
) AS ranked
WHERE duplicate.id = ranked.id AND ranked.row_number > 1;
--> statement-breakpoint
DROP INDEX "title_alias_normalized_identity_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "title_alias_normalized_identity_uq" ON "title_aliases" USING btree ("title_id",lower(btrim("title")));
