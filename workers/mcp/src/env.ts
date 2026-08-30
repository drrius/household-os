import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export type WorkerEnv = {
  /** Origin of the Household OS deployment, e.g. https://household.example. */
  HOUSEHOLD_APP_URL: string;
  /** Storage for OAuth clients, grants, and tokens (workers-oauth-provider). */
  OAUTH_KV: KVNamespace;
  /** Injected by workers-oauth-provider on non-API routes. */
  OAUTH_PROVIDER: OAuthHelpers;
};
