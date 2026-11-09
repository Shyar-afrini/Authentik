CREATE TABLE "auth"."member_branch" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"branch_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."member_branch" ADD CONSTRAINT "member_branch_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "auth"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."member_branch" ADD CONSTRAINT "member_branch_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_branch_member_branch_idx" ON "auth"."member_branch" USING btree ("member_id","branch_id");--> statement-breakpoint
CREATE INDEX "member_branch_memberId_idx" ON "auth"."member_branch" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "member_branch_organizationId_idx" ON "auth"."member_branch" USING btree ("organization_id");
