CREATE TABLE "auth"."_uuid_map" ("old" text PRIMARY KEY, "new" uuid NOT NULL DEFAULT gen_random_uuid());
--> statement-breakpoint
DO $$ BEGIN
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."user" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."session" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "user_id" FROM auth."session" WHERE "user_id" IS NOT NULL AND "user_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "impersonated_by" FROM auth."session" WHERE "impersonated_by" IS NOT NULL AND "impersonated_by" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "active_organization_id" FROM auth."session" WHERE "active_organization_id" IS NOT NULL AND "active_organization_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."account" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "user_id" FROM auth."account" WHERE "user_id" IS NOT NULL AND "user_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."verification" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."two_factor" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "user_id" FROM auth."two_factor" WHERE "user_id" IS NOT NULL AND "user_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."jwks" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."organization" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."member" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "organization_id" FROM auth."member" WHERE "organization_id" IS NOT NULL AND "organization_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "user_id" FROM auth."member" WHERE "user_id" IS NOT NULL AND "user_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."invitation" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "organization_id" FROM auth."invitation" WHERE "organization_id" IS NOT NULL AND "organization_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "inviter_id" FROM auth."invitation" WHERE "inviter_id" IS NOT NULL AND "inviter_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."member_permission" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "member_id" FROM auth."member_permission" WHERE "member_id" IS NOT NULL AND "member_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "organization_id" FROM auth."member_permission" WHERE "organization_id" IS NOT NULL AND "organization_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."member_branch" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "member_id" FROM auth."member_branch" WHERE "member_id" IS NOT NULL AND "member_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "organization_id" FROM auth."member_branch" WHERE "organization_id" IS NOT NULL AND "organization_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."audit_log" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "organization_id" FROM auth."audit_log" WHERE "organization_id" IS NOT NULL AND "organization_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "actor_user_id" FROM auth."audit_log" WHERE "actor_user_id" IS NOT NULL AND "actor_user_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."application_key" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "created_by" FROM auth."application_key" WHERE "created_by" IS NOT NULL AND "created_by" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "organization_id" FROM auth."organization_application" WHERE "organization_id" IS NOT NULL AND "organization_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "created_by" FROM auth."organization_application" WHERE "created_by" IS NOT NULL AND "created_by" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."app_permission_def" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."app_role_template" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."oauth_client" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "user_id" FROM auth."oauth_client" WHERE "user_id" IS NOT NULL AND "user_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."oauth_client_assertion" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."oauth_client_resource" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."oauth_resource" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."oauth_access_token" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "user_id" FROM auth."oauth_access_token" WHERE "user_id" IS NOT NULL AND "user_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "session_id" FROM auth."oauth_access_token" WHERE "session_id" IS NOT NULL AND "session_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "refresh_id" FROM auth."oauth_access_token" WHERE "refresh_id" IS NOT NULL AND "refresh_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."oauth_refresh_token" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "user_id" FROM auth."oauth_refresh_token" WHERE "user_id" IS NOT NULL AND "user_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "session_id" FROM auth."oauth_refresh_token" WHERE "session_id" IS NOT NULL AND "session_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "id" FROM auth."oauth_consent" WHERE "id" IS NOT NULL AND "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
  INSERT INTO auth._uuid_map (old) SELECT DISTINCT "user_id" FROM auth."oauth_consent" WHERE "user_id" IS NOT NULL AND "user_id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' ON CONFLICT DO NOTHING;
END $$;
--> statement-breakpoint
CREATE FUNCTION "auth"."_to_uuid"(v text) RETURNS uuid LANGUAGE plpgsql STABLE AS $$ DECLARE r uuid; BEGIN SELECT m.new INTO r FROM auth._uuid_map m WHERE m.old = v; IF r IS NOT NULL THEN RETURN r; END IF; RETURN v::uuid; END $$;
--> statement-breakpoint
CREATE TABLE "auth"."_fk_saved" AS SELECT conrelid::regclass::text AS tbl, conname AS name, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE contype = 'f' AND connamespace = 'auth'::regnamespace;
--> statement-breakpoint
DO $$ DECLARE r record; BEGIN FOR r IN SELECT * FROM auth._fk_saved LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.name); END LOOP; END $$;
--> statement-breakpoint
UPDATE "auth"."session" SET "active_organization_id" = NULL WHERE "active_organization_id" IS NOT NULL AND "active_organization_id" NOT IN (SELECT "id" FROM "auth"."organization");
--> statement-breakpoint
UPDATE "auth"."session" SET "impersonated_by" = NULL WHERE "impersonated_by" IS NOT NULL AND "impersonated_by" NOT IN (SELECT "id" FROM "auth"."user");
--> statement-breakpoint
UPDATE "auth"."application_key" SET "created_by" = NULL WHERE "created_by" IS NOT NULL AND "created_by" NOT IN (SELECT "id" FROM "auth"."user");
--> statement-breakpoint
UPDATE "auth"."organization_application" SET "created_by" = NULL WHERE "created_by" IS NOT NULL AND "created_by" NOT IN (SELECT "id" FROM "auth"."user");
--> statement-breakpoint
ALTER TABLE "auth"."user" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."user" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."user" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."session" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."session" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."session" ALTER COLUMN "user_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."session" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("user_id");
--> statement-breakpoint
ALTER TABLE "auth"."session" ALTER COLUMN "impersonated_by" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."session" ALTER COLUMN "impersonated_by" SET DATA TYPE uuid USING "auth"."_to_uuid"("impersonated_by");
--> statement-breakpoint
ALTER TABLE "auth"."session" ALTER COLUMN "active_organization_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."session" ALTER COLUMN "active_organization_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("active_organization_id");
--> statement-breakpoint
ALTER TABLE "auth"."account" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."account" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."account" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."account" ALTER COLUMN "user_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."account" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("user_id");
--> statement-breakpoint
ALTER TABLE "auth"."verification" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."verification" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."verification" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."two_factor" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."two_factor" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."two_factor" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."two_factor" ALTER COLUMN "user_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."two_factor" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("user_id");
--> statement-breakpoint
ALTER TABLE "auth"."jwks" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."jwks" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."jwks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."organization" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."organization" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."organization" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."member" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."member" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."member" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."member" ALTER COLUMN "organization_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."member" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("organization_id");
--> statement-breakpoint
ALTER TABLE "auth"."member" ALTER COLUMN "user_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."member" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("user_id");
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ALTER COLUMN "organization_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("organization_id");
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ALTER COLUMN "inviter_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ALTER COLUMN "inviter_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("inviter_id");
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "member_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "member_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("member_id");
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "organization_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("organization_id");
--> statement-breakpoint
ALTER TABLE "auth"."member_branch" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."member_branch" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."member_branch" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."member_branch" ALTER COLUMN "member_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."member_branch" ALTER COLUMN "member_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("member_id");
--> statement-breakpoint
ALTER TABLE "auth"."member_branch" ALTER COLUMN "organization_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."member_branch" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("organization_id");
--> statement-breakpoint
ALTER TABLE "auth"."audit_log" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."audit_log" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."audit_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."audit_log" ALTER COLUMN "organization_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."audit_log" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("organization_id");
--> statement-breakpoint
ALTER TABLE "auth"."audit_log" ALTER COLUMN "actor_user_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."audit_log" ALTER COLUMN "actor_user_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("actor_user_id");
--> statement-breakpoint
ALTER TABLE "auth"."application_key" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."application_key" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."application_key" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."application_key" ALTER COLUMN "created_by" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."application_key" ALTER COLUMN "created_by" SET DATA TYPE uuid USING "auth"."_to_uuid"("created_by");
--> statement-breakpoint
ALTER TABLE "auth"."organization_application" ALTER COLUMN "organization_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."organization_application" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("organization_id");
--> statement-breakpoint
ALTER TABLE "auth"."organization_application" ALTER COLUMN "created_by" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."organization_application" ALTER COLUMN "created_by" SET DATA TYPE uuid USING "auth"."_to_uuid"("created_by");
--> statement-breakpoint
ALTER TABLE "auth"."app_permission_def" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."app_permission_def" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."app_permission_def" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."app_role_template" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."app_role_template" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."app_role_template" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client" ALTER COLUMN "user_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("user_id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client_assertion" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client_assertion" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client_assertion" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client_resource" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client_resource" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_client_resource" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."oauth_resource" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_resource" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_resource" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ALTER COLUMN "user_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("user_id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ALTER COLUMN "session_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ALTER COLUMN "session_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("session_id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ALTER COLUMN "refresh_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_access_token" ALTER COLUMN "refresh_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("refresh_id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" ALTER COLUMN "user_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("user_id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" ALTER COLUMN "session_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_refresh_token" ALTER COLUMN "session_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("session_id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_consent" ALTER COLUMN "id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_consent" ALTER COLUMN "id" SET DATA TYPE uuid USING "auth"."_to_uuid"("id");
--> statement-breakpoint
ALTER TABLE "auth"."oauth_consent" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "auth"."oauth_consent" ALTER COLUMN "user_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."oauth_consent" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "auth"."_to_uuid"("user_id");
--> statement-breakpoint
DO $$ DECLARE r record; BEGIN FOR r IN SELECT * FROM auth._fk_saved LOOP EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.tbl, r.name, r.def); END LOOP; END $$;
--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_active_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "auth"."organization"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_impersonated_by_fk" FOREIGN KEY ("impersonated_by") REFERENCES "auth"."user"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "auth"."application_key" ADD CONSTRAINT "application_key_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "auth"."organization_application" ADD CONSTRAINT "organization_application_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."user"("id") ON DELETE set null;
--> statement-breakpoint
DROP TABLE "auth"."_fk_saved";
--> statement-breakpoint
DROP FUNCTION "auth"."_to_uuid"(text);
--> statement-breakpoint
DROP TABLE "auth"."_uuid_map";
--> statement-breakpoint
CREATE TYPE "auth"."permission_effect" AS ENUM ('allow', 'deny');
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "effect" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "effect" SET DATA TYPE "auth"."permission_effect" USING "effect"::"auth"."permission_effect";
--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "effect" SET DEFAULT 'allow';
--> statement-breakpoint
CREATE TYPE "auth"."invitation_status" AS ENUM ('pending', 'accepted', 'rejected', 'canceled');
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ALTER COLUMN "status" SET DATA TYPE "auth"."invitation_status" USING "status"::"auth"."invitation_status";
--> statement-breakpoint
ALTER TABLE "auth"."invitation" ALTER COLUMN "status" SET DEFAULT 'pending';
