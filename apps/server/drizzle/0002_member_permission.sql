CREATE TABLE "auth"."member_permission" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"action" text NOT NULL,
	"subject" text NOT NULL,
	"effect" text DEFAULT 'allow' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ADD CONSTRAINT "member_permission_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "auth"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ADD CONSTRAINT "member_permission_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_permission_member_action_subject_idx" ON "auth"."member_permission" USING btree ("member_id","action","subject");--> statement-breakpoint
CREATE INDEX "member_permission_memberId_idx" ON "auth"."member_permission" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "member_permission_organizationId_idx" ON "auth"."member_permission" USING btree ("organization_id");
