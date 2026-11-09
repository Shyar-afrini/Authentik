CREATE TABLE "auth"."organization_setting" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"require_two_factor" boolean DEFAULT false NOT NULL,
	"session_max_age_seconds" integer,
	"password_min_length" integer DEFAULT 8 NOT NULL,
	"allowed_origins" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "organization_setting_password_min_length_check" CHECK ("password_min_length" between 8 and 128),
	CONSTRAINT "organization_setting_session_max_age_check" CHECK ("session_max_age_seconds" is null or "session_max_age_seconds" between 300 and 31536000)
);--> statement-breakpoint
ALTER TABLE "auth"."organization_setting" ADD CONSTRAINT "organization_setting_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."organization_setting" ADD CONSTRAINT "organization_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."organization_application" ADD COLUMN "client_types" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."organization_application" ADD CONSTRAINT "organization_application_client_types_check" CHECK ("client_types" <@ ARRAY['nestjs','nextjs','react-native']::text[]);
