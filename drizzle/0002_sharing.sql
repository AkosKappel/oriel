CREATE TABLE "invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"role" "member_role" NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" text,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invite_role" CHECK ("invite"."role" <> 'owner')
);
--> statement-breakpoint
-- Existing members get their current name; new ones get it when they join.
ALTER TABLE "space_member" ADD COLUMN "member_name" text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE "space_member" SET "member_name" = "user"."name" FROM "user" WHERE "user"."id" = "space_member"."user_id";--> statement-breakpoint
ALTER TABLE "space_member" ALTER COLUMN "member_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invite_space_id_index" ON "invite" USING btree ("space_id");--> statement-breakpoint
-- Devices need space names and roles; invites stay on the server.
ALTER PUBLICATION powersync ADD TABLE space;
