ALTER TABLE "entries" ADD COLUMN "completed_by" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "completed_by" text;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_completed_by_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;