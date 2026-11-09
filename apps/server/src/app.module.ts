import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ApplicationsController, ApplicationsListController } from "./applications/applications.controller.js";
import { AuditController } from "./audit/audit.controller.js";
import { BetterAuthModule } from "./better-auth/better-auth.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { PrincipalService } from "./common/principal.service.js";
import { ConfigModule } from "./config/config.module.js";
import { DrainState, HealthController } from "./health/health.controller.js";
import { MembersController } from "./members/members.controller.js";
import { OAuthClientsController } from "./organizations/oauth-clients.controller.js";
import { OrganizationsController } from "./organizations/organizations.controller.js";
import { SessionService } from "./sessions/session.service.js";
import { SessionsController } from "./sessions/sessions.controller.js";

@Module({
  imports: [ConfigModule, BetterAuthModule],
  controllers: [
    HealthController,
    SessionsController,
    ApplicationsListController,
    ApplicationsController,
    OrganizationsController,
    OAuthClientsController,
    MembersController,
    AuditController,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }, PrincipalService, SessionService, DrainState],
})
export class AppModule {}
