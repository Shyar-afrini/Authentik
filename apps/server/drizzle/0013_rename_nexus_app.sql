DO $$
DECLARE
  old_audience text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "auth"."application" WHERE "id" = 'nexus') THEN RETURN; END IF;
  SELECT "audience" INTO old_audience FROM "auth"."application" WHERE "id" = 'nexus';
  UPDATE "auth"."application" SET "audience" = NULL WHERE "id" = 'nexus';
  INSERT INTO "auth"."application" ("id", "key", "name", "audience", "created_at", "updated_at")
    SELECT 'authentik', 'authentik', 'Authentik', old_audience, "created_at", now() FROM "auth"."application" WHERE "id" = 'nexus'
    ON CONFLICT DO NOTHING;
  UPDATE "auth"."app_permission_def" SET "application_id" = 'authentik' WHERE "application_id" = 'nexus';
  UPDATE "auth"."app_role_template" SET "application_id" = 'authentik' WHERE "application_id" = 'nexus';
  UPDATE "auth"."application_key" SET "application_id" = 'authentik' WHERE "application_id" = 'nexus';
  UPDATE "auth"."member_permission" SET "application_id" = 'authentik' WHERE "application_id" = 'nexus';
  UPDATE "auth"."organization_application" SET "application_id" = 'authentik' WHERE "application_id" = 'nexus';
  DELETE FROM "auth"."application" WHERE "id" = 'nexus';
END $$;--> statement-breakpoint
ALTER TABLE "auth"."member_permission" ALTER COLUMN "application_id" SET DEFAULT 'authentik';
