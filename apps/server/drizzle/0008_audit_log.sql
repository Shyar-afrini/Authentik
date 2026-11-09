CREATE TABLE "auth"."audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" text,
	"actor_user_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"ip" text,
	"request_id" text,
	"diff" jsonb
);--> statement-breakpoint
CREATE INDEX "audit_log_org_at_idx" ON "auth"."audit_log" USING btree ("organization_id","at" DESC);--> statement-breakpoint
CREATE INDEX "audit_log_actor_at_idx" ON "auth"."audit_log" USING btree ("actor_user_id","at" DESC);--> statement-breakpoint
CREATE INDEX "audit_log_action_at_idx" ON "auth"."audit_log" USING btree ("action","at" DESC);--> statement-breakpoint
CREATE FUNCTION "auth"."audit_log_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'auth.audit_log is insert-only';
END $$;--> statement-breakpoint
CREATE TRIGGER "audit_log_no_update" BEFORE UPDATE ON "auth"."audit_log" FOR EACH ROW EXECUTE FUNCTION "auth"."audit_log_immutable"();
