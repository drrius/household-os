import type { AuthRequest } from "@cloudflare/workers-oauth-provider";

import type { WorkerEnv } from "./env";

/**
 * Non-API routes of the worker: the OAuth authorize hop to the Household OS
 * consent page, and the callback that swaps the app's one-time code for the
 * long-lived grant the OAuth layer stores (encrypted) in the token props.
 */

function packState(authRequest: AuthRequest): string {
  return btoa(JSON.stringify(authRequest));
}

function unpackState(state: string): AuthRequest | null {
  try {
    return JSON.parse(atob(state)) as AuthRequest;
  } catch {
    return null;
  }
}

async function handleAuthorize(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const authRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  const client = await env.OAUTH_PROVIDER.lookupClient(authRequest.clientId);
  const consentUrl = new URL(
    "/security/connections/authorize",
    env.HOUSEHOLD_APP_URL,
  );
  consentUrl.searchParams.set(
    "redirect_uri",
    new URL("/callback", request.url).toString(),
  );
  consentUrl.searchParams.set("state", packState(authRequest));
  consentUrl.searchParams.set(
    "client_name",
    client?.clientName ?? "an MCP client",
  );
  return Response.redirect(consentUrl.toString(), 302);
}

async function handleCallback(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const authRequest = state === null ? null : unpackState(state);
  if (authRequest === null) {
    return new Response("Invalid state", { status: 400 });
  }
  if (url.searchParams.get("error") !== null) {
    return new Response("The connection was declined in Household OS.", {
      status: 403,
    });
  }
  const code = url.searchParams.get("code");
  if (code === null) {
    return new Response("Missing code", { status: 400 });
  }

  const exchange = await fetch(
    new URL("/api/mcp/exchange", env.HOUSEHOLD_APP_URL),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    },
  );
  if (!exchange.ok) {
    return new Response("Household OS rejected the authorization code.", {
      status: 502,
    });
  }
  const payload = (await exchange.json()) as {
    grantToken: string;
    member: { displayName: string };
  };

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: authRequest,
    userId: payload.member.displayName,
    metadata: { connectedAt: new Date().toISOString() },
    scope: authRequest.scope,
    props: { grantToken: payload.grantToken },
  });
  return Response.redirect(redirectTo, 302);
}

export async function handleDefaultRequest(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/authorize") {
    return handleAuthorize(request, env);
  }
  if (url.pathname === "/callback") {
    return handleCallback(request, env);
  }
  return new Response(
    "Household OS MCP server. Connect an MCP client to /mcp and complete the OAuth flow.",
    { status: 200, headers: { "content-type": "text/plain" } },
  );
}
