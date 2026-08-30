import { z } from "zod";

import {
  getMcpEnv,
  GRANT_TTL,
  signGrantToken,
  verifyAuthorizationCode,
} from "@/lib/mcp/tokens";

const exchangeBodySchema = z.object({ code: z.string().min(1) });

/**
 * Redeems a one-time authorization code (minted by the in-app consent page)
 * for the long-lived grant token the MCP worker stores.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getMcpEnv();
  if (env === null) {
    return Response.json(
      { error: "The MCP bridge is not configured on this deployment" },
      { status: 503 },
    );
  }
  const parsed = exchangeBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "code is required" }, { status: 400 });
  }
  const principal = await verifyAuthorizationCode(env, parsed.data.code);
  if (principal === null) {
    return Response.json(
      { error: "Invalid or expired authorization code" },
      { status: 401 },
    );
  }
  return Response.json({
    grantToken: await signGrantToken(env, principal),
    expiresInSeconds: GRANT_TTL,
    member: { displayName: principal.displayName },
  });
}
