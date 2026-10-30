ALTER TABLE "items" ADD COLUMN "repeat" text;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_repeat" CHECK ("items"."repeat" in ('daily', 'weekly', 'monthly'));