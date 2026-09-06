CREATE TABLE "title_trivia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_trivia_values_check" CHECK (btrim("title_trivia"."text") <> '')
);
--> statement-breakpoint
ALTER TABLE "title_trivia" ADD CONSTRAINT "title_trivia_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "title_trivia_title_position_uq" ON "title_trivia" USING btree ("title_id","position");