CREATE TABLE "account_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"installment_id" uuid NOT NULL,
	"episode_id" uuid,
	"device_id" text NOT NULL,
	"device_name" text DEFAULT '' NOT NULL,
	"path" text NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_downloads_state_check" CHECK ("account_downloads"."state" in ('queued', 'downloading', 'paused', 'completed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "account_downloads" ADD CONSTRAINT "account_downloads_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_downloads" ADD CONSTRAINT "account_downloads_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_downloads" ADD CONSTRAINT "account_downloads_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_downloads_unit_uq" ON "account_downloads" USING btree ("account_id","device_id","installment_id",coalesce("episode_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "account_downloads_installment_idx" ON "account_downloads" USING btree ("installment_id");--> statement-breakpoint
CREATE INDEX "account_downloads_episode_idx" ON "account_downloads" USING btree ("episode_id");