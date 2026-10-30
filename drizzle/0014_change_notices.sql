ALTER TABLE "push_subscription" ADD COLUMN "reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD COLUMN "changes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD COLUMN "changes_since" timestamp with time zone DEFAULT now() NOT NULL;