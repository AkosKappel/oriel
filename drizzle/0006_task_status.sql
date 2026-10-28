ALTER TABLE "items" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_status" CHECK ("items"."status" in ('in_progress', 'waiting'));