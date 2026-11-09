import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  ip?: string;
  /** Filled in once the caller is authenticated, so audit rows know who acted. */
  actorUserId?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(ctx: RequestContext, fn: () => T): T => storage.run(ctx, fn);
export const requestContext = (): RequestContext | undefined => storage.getStore();
