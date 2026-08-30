import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Lets the MCP bridge run the existing member-scoped command layer without a
 * cookie session: inside `runWithBearerSession`, `createClient()` talks to
 * Supabase with the given member access token (RLS and in-database
 * authorization stay fully enforced) and `getVerifiedIdentity()` returns the
 * identity the bridge already verified when it validated the grant.
 */
export type BearerSession = {
  /** Short-lived Supabase access JWT for the member. */
  accessToken: string;
  userId: string;
  email: string | null;
};

const storage = new AsyncLocalStorage<BearerSession>();

export function runWithBearerSession<T>(
  session: BearerSession,
  callback: () => Promise<T>,
): Promise<T> {
  return storage.run(session, callback);
}

export function getBearerSession(): BearerSession | null {
  return storage.getStore() ?? null;
}
