CREATE TYPE "public"."award_result" AS ENUM('winner', 'nominee');
--> statement-breakpoint
CREATE UNIQUE INDEX "installments_id_title_uq" ON "installments" USING btree ("id", "title_id");
--> statement-breakpoint
CREATE TABLE "award_recognitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"installment_id" uuid,
	"organization_slug" text NOT NULL,
	"organization_name" text NOT NULL,
	"category" text NOT NULL,
	"year" integer,
	"result" "award_result" NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"source_url" text,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_recognitions_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade,
	CONSTRAINT "award_recognitions_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade,
	CONSTRAINT "award_recognitions_installment_title_fk" FOREIGN KEY ("installment_id", "title_id") REFERENCES "public"."installments"("id", "title_id") ON DELETE cascade,
	CONSTRAINT "award_recognitions_values_check" CHECK (btrim("organization_slug") <> '' and btrim("organization_name") <> '' and btrim("category") <> '' and ("year" is null or "year" between 1900 and 2100) and "position" >= 0)
);
--> statement-breakpoint
CREATE INDEX "award_recognitions_title_idx" ON "award_recognitions" USING btree ("title_id");
--> statement-breakpoint
CREATE INDEX "award_recognitions_installment_idx" ON "award_recognitions" USING btree ("installment_id");
--> statement-breakpoint
CREATE INDEX "award_recognitions_filter_idx" ON "award_recognitions" USING btree ("organization_slug", "result");
