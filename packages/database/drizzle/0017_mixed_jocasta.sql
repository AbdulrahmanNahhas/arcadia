DROP INDEX "external_identity_provider_uq";--> statement-breakpoint
ALTER TABLE "external_identities" ALTER COLUMN "title_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "external_identities" ADD COLUMN "installment_id" uuid;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "tmdb_id" integer;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "imdb_id" text;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "tvdb_id" integer;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "anilist_id" integer;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "mal_id" integer;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "tmdb_id" integer;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "imdb_id" text;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "tvdb_id" integer;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "anilist_id" integer;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "mal_id" integer;--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_identities_installment_idx" ON "external_identities" USING btree ("installment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "installments_tmdb_id_uq" ON "installments" USING btree ("tmdb_id") WHERE "installments"."tmdb_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "installments_imdb_id_uq" ON "installments" USING btree ("imdb_id") WHERE "installments"."imdb_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "installments_tvdb_id_uq" ON "installments" USING btree ("tvdb_id") WHERE "installments"."tvdb_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "installments_anilist_id_uq" ON "installments" USING btree ("anilist_id") WHERE "installments"."anilist_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "installments_mal_id_uq" ON "installments" USING btree ("mal_id") WHERE "installments"."mal_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "titles_tmdb_id_uq" ON "titles" USING btree ("tmdb_id") WHERE "titles"."tmdb_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "titles_imdb_id_uq" ON "titles" USING btree ("imdb_id") WHERE "titles"."imdb_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "titles_tvdb_id_uq" ON "titles" USING btree ("tvdb_id") WHERE "titles"."tvdb_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "titles_anilist_id_uq" ON "titles" USING btree ("anilist_id") WHERE "titles"."anilist_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "titles_mal_id_uq" ON "titles" USING btree ("mal_id") WHERE "titles"."mal_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "external_identity_provider_uq" ON "external_identities" USING btree ("title_id","installment_id",lower(btrim("provider")),"external_id");--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identity_owner_check" CHECK (num_nonnulls("external_identities"."title_id", "external_identities"."installment_id") = 1);--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_imdb_id_check" CHECK ("installments"."imdb_id" is null or "installments"."imdb_id" ~ '^tt[0-9]{7,10}$');--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_imdb_id_check" CHECK ("titles"."imdb_id" is null or "titles"."imdb_id" ~ '^tt[0-9]{7,10}$');