CREATE TABLE "auth"."application_key" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"hint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	CONSTRAINT "application_key_secret_hash_unique" UNIQUE("secret_hash")
);--> statement-breakpoint
ALTER TABLE "auth"."application_key" ADD CONSTRAINT "application_key_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "auth"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_key_one_active_idx" ON "auth"."application_key" USING btree ("application_id") WHERE "revoked_at" is null;
