-- Fail loudly instead of deleting rows if legacy data already violates the new uniqueness rules.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "auth"."member" GROUP BY "user_id", "organization_id" HAVING count(*) > 1) THEN
		RAISE EXCEPTION 'auth.member has duplicate (user_id, organization_id) rows; merge them before migrating';
	END IF;
	IF EXISTS (SELECT 1 FROM "auth"."account" GROUP BY "provider_id", "account_id" HAVING count(*) > 1) THEN
		RAISE EXCEPTION 'auth.account has duplicate (provider_id, account_id) rows; merge them before migrating';
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "member_user_org_idx" ON "auth"."member" USING btree ("user_id","organization_id");--> statement-breakpoint
DROP INDEX "auth"."member_userId_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_idx" ON "auth"."account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_expiresAt_idx" ON "auth"."session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "verification_expiresAt_idx" ON "auth"."verification" USING btree ("expires_at");
