import { Global, Module, type DynamicModule } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { AuthGuard } from "./auth.guard.js";
import { CaslGuard } from "./casl.guard.js";
import {
  NEXUS_AUTH,
  type NexusAuthOptions,
} from "./auth.port.js";

let registered = false;

@Global()
@Module({})
export class AuthModule {
  /**
   * Idempotent: the first successful forRoot in the process registers APP_GUARD.
   * Later domain forRoot({ auth }) calls return an empty module so Nest does not
   * attach four identical guards.
   */
  static forRoot(auth: NexusAuthOptions): DynamicModule {
    if (registered) {
      return {
        module: AuthModule,
        providers: [],
        exports: [],
      };
    }
    registered = true;
    return {
      module: AuthModule,
      providers: [
        Reflector,
        { provide: NEXUS_AUTH, useValue: auth },
        AuthGuard,
        CaslGuard,
        { provide: APP_GUARD, useExisting: AuthGuard },
        { provide: APP_GUARD, useExisting: CaslGuard },
      ],
      exports: [NEXUS_AUTH, AuthGuard, CaslGuard],
    };
  }

  /** Test helper — reset idempotency between Nest app boots in the same process. */
  static resetForTests() {
    registered = false;
  }
}
