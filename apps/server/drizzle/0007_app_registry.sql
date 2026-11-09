CREATE TABLE "auth"."application" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"audience" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "application_key_unique" UNIQUE("key"),
	CONSTRAINT "application_audience_unique" UNIQUE("audience")
);--> statement-breakpoint
CREATE TABLE "auth"."app_permission_def" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"subject" text NOT NULL,
	"action" text NOT NULL,
	"description" text
);--> statement-breakpoint
CREATE TABLE "auth"."app_role_template" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"role_key" text NOT NULL,
	"grants" jsonb DEFAULT '[]'::jsonb NOT NULL
);--> statement-breakpoint
ALTER TABLE "auth"."app_permission_def" ADD CONSTRAINT "app_permission_def_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "auth"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."app_role_template" ADD CONSTRAINT "app_role_template_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "auth"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_permission_def_app_subject_action_idx" ON "auth"."app_permission_def" USING btree ("application_id","subject","action");--> statement-breakpoint
CREATE UNIQUE INDEX "app_role_template_app_role_idx" ON "auth"."app_role_template" USING btree ("application_id","role_key");--> statement-breakpoint
CREATE INDEX "app_role_template_applicationId_idx" ON "auth"."app_role_template" USING btree ("application_id");--> statement-breakpoint
INSERT INTO "auth"."application" ("id", "key", "name") VALUES ('nexus', 'nexus', 'Nexus ERP') ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ADD COLUMN "application_id" text DEFAULT 'nexus' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ADD CONSTRAINT "member_permission_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "auth"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "auth"."member_permission_member_action_subject_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "member_permission_member_app_action_subject_idx" ON "auth"."member_permission" USING btree ("member_id","application_id","action","subject");
--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_client_resource_client_resource_idx" ON "auth"."oauth_client_resource" USING btree ("client_id","resource_id");
