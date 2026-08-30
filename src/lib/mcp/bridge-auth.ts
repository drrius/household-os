import "server-only";

import { runWithBearerSession } from "@/lib/auth/bearer-context";
import { getMemberContext } from "@/lib/auth/member-context";
import {
  getMcpEnv,
  signSupabaseAccessToken,
  verifyGrantToken,
  type McpPrincipal,
} from "@/lib/mcp/tokens";

export type BridgeAuthFailure = { status: 401 | 403 | 503; message: string };

export type BridgeAuthResult =
  | { ok: true; run: <T>(callback: () => Promise<T>) => Promise<T> }
  | { ok: false; failure: BridgeAuthFailure };

function failure(status: 401 | 403 | 503, message: string): BridgeAuthResult {
  return { ok: false, failure: { status, message } };
}

/**
 * Authenticates one MCP bridge request: verifies the bearer grant, mints the
 * member's short-lived Supabase token, and confirms the member still belongs
 * to a household before any tool runs. As `AGENTS.md` requires, this treats
 * the bridge exactly like a public API endpoint.
 */
export async function authenticateBridgeRequest(
  request: Request,
): Promise<BridgeAuthResult> {
  const env = getMcpEnv();
  if (env === null) {
    return failure(503, "The MCP bridge is not configured on this deployment");
  }
  const header = request.headers.get("authorization");
  if (header === null || !header.startsWith("Bearer ")) {
    return failure(401, "Missing bearer grant");
  }
  const principal: McpPrincipal | null = await verifyGrantToken(
    env,
    header.slice("Bearer ".length).trim(),
  );
  if (principal === null) {
    return failure(401, "Invalid or expired grant");
  }
  const accessToken = await signSupabaseAccessToken(env, principal);
  const session = {
    accessToken,
    userId: principal.userId,
    email: principal.email,
  };

  const membership = await runWithBearerSession(session, getMemberContext);
  if (membership === null) {
    return failure(403, "The grant's member no longer belongs to a household");
  }

  return {
    ok: true,
    run: (callback) => runWithBearerSession(session, callback),
  };
}
