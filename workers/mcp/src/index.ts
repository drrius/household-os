import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp";

import { handleDefaultRequest } from "./authorize";
import type { WorkerEnv } from "./env";
import { buildHouseholdMcpServer } from "./server";

/**
 * Household OS MCP server, following the sudowealth/schwab-mcp shape:
 * workers-oauth-provider fronts the worker (dynamic client registration,
 * PKCE, token storage in KV), and the API route serves MCP over streamable
 * HTTP. Tool calls run against the Household OS bridge as the member who
 * approved the connection.
 */

const mcpApiHandler = {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // workers-oauth-provider attaches the grant's props to the context.
    const grantToken = (ctx as { props?: { grantToken?: string } }).props
      ?.grantToken;
    if (typeof grantToken !== "string" || grantToken.length === 0) {
      return Response.json(
        { error: "Missing grant; reconnect the MCP client" },
        { status: 401 },
      );
    }
    const handler = createMcpHandler(
      () => buildHouseholdMcpServer(env.HOUSEHOLD_APP_URL, grantToken),
      { route: "/mcp" },
    );
    return handler(request, env, ctx);
  },
};

export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: mcpApiHandler,
  defaultHandler: {
    fetch: (request: Request, env: WorkerEnv) =>
      handleDefaultRequest(request, env),
  },
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
