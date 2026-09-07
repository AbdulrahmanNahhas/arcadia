ALTER TABLE "accounts" DROP CONSTRAINT "accounts_avatar_key_check";--> statement-breakpoint
UPDATE "accounts"
SET "avatar_key" = CASE "avatar_key"
  WHEN 'orbit-1' THEN 'anon-1.png'
  WHEN 'orbit-2' THEN 'anon-2.png'
  WHEN 'orbit-3' THEN 'anon-3.png'
  WHEN 'orbit-4' THEN 'anon-4.png'
  WHEN 'orbit-5' THEN 'anon-5.png'
  ELSE "avatar_key"
END
WHERE "avatar_key" IN ('orbit-1', 'orbit-2', 'orbit-3', 'orbit-4', 'orbit-5');--> statement-breakpoint
UPDATE "account_invites"
SET "avatar_key" = CASE "avatar_key"
  WHEN 'orbit-1' THEN 'anon-1.png'
  WHEN 'orbit-2' THEN 'anon-2.png'
  WHEN 'orbit-3' THEN 'anon-3.png'
  WHEN 'orbit-4' THEN 'anon-4.png'
  WHEN 'orbit-5' THEN 'anon-5.png'
  ELSE "avatar_key"
END
WHERE "avatar_key" IN ('orbit-1', 'orbit-2', 'orbit-3', 'orbit-4', 'orbit-5');--> statement-breakpoint
ALTER TABLE "account_invites" ALTER COLUMN "avatar_key" SET DEFAULT 'avatar-1.png';--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "avatar_key" SET DEFAULT 'avatar-1.png';
