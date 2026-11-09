CREATE TABLE "auth"."organization_application" (
	"organization_id" text NOT NULL,
	"application_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "organization_application_organization_id_application_id_pk" PRIMARY KEY("organization_id","application_id")
);--> statement-breakpoint
ALTER TABLE "auth"."organization_application" ADD CONSTRAINT "organization_application_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."organization_application" ADD CONSTRAINT "organization_application_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "auth"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_application_app_idx" ON "auth"."organization_application" USING btree ("application_id");--> statement-breakpoint
INSERT INTO "auth"."application" ("id", "key", "name") VALUES ('nexus', 'nexus', 'Nexus ERP') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "auth"."organization_application" ("organization_id", "application_id") SELECT "id", 'nexus' FROM "auth"."organization" ON CONFLICT DO NOTHING;
