import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

/**
 * Token plumbing for the MCP bridge. Three short chains of custody:
 *
 * 1. Authorization code — minted when a member approves a connection on the
 *    in-app consent page, redeemed once by the MCP worker within minutes.
 * 2. Grant token — the long-lived credential the worker stores (encrypted at
 *    rest by workers-oauth-provider) and sends as a bearer on every call.
 * 3. Member access JWT — minted per request from a verified grant and handed
 *    to Supabase, so RLS and in-database `auth.uid()` checks keep enforcing
 *    authorization exactly as they do for a signed-in browser session.
 *
 * Revocation is by rotating MCP_GRANT_SECRET (all grants at once). A
 * per-grant revocation table is a deliberate follow-up.
 */

const CODE_AUDIENCE = "household-mcp-code";
const GRANT_AUDIENCE = "household-mcp-grant";
const CODE_TTL_SECONDS = 5 * 60;
const GRANT_TTL_SECONDS = 90 * 24 * 60 * 60;
const SUPABASE_JWT_TTL_SECONDS = 5 * 60;

export type McpPrincipal = {
  userId: string;
  email: string | null;
  displayName: string;
};

const principalClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().nullable(),
  displayName: z.string().min(1),
});

const mcpEnvSchema = z.object({
  MCP_GRANT_SECRET: z.string().min(32),
  SUPABASE_JWT_SECRET: z.string().min(32),
  MCP_ALLOWED_REDIRECT_ORIGINS: z.string().min(1),
});

export type McpEnv = z.infer<typeof mcpEnvSchema>;

export function getMcpEnv(): McpEnv | null {
  const parsed = mcpEnvSchema.safeParse({
    MCP_GRANT_SECRET: process.env.MCP_GRANT_SECRET,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    MCP_ALLOWED_REDIRECT_ORIGINS: process.env.MCP_ALLOWED_REDIRECT_ORIGINS,
  });
  return parsed.success ? parsed.data : null;
}

export function isRedirectUriAllowed(env: McpEnv, redirectUri: string): boolean {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
  const allowed = env.MCP_ALLOWED_REDIRECT_ORIGINS.split(",").map((origin) =>
    origin.trim(),
  );
  return allowed.includes(url.origin);
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

async function signPrincipalToken(
  env: McpEnv,
  principal: McpPrincipal,
  audience: string,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({
    email: principal.email,
    displayName: principal.displayName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(principal.userId)
    .setAudience(audience)
    .setIssuer("household-os")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secretKey(env.MCP_GRANT_SECRET));
}

async function verifyPrincipalToken(
  env: McpEnv,
  token: string,
  audience: string,
): Promise<McpPrincipal | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      secretKey(env.MCP_GRANT_SECRET),
      { audience, issuer: "household-os" },
    );
    const claims = principalClaimsSchema.parse(payload);
    return {
      userId: claims.sub,
      email: claims.email,
      displayName: claims.displayName,
    };
  } catch {
    return null;
  }
}

export function signAuthorizationCode(
  env: McpEnv,
  principal: McpPrincipal,
): Promise<string> {
  return signPrincipalToken(env, principal, CODE_AUDIENCE, CODE_TTL_SECONDS);
}

export function verifyAuthorizationCode(
  env: McpEnv,
  code: string,
): Promise<McpPrincipal | null> {
  return verifyPrincipalToken(env, code, CODE_AUDIENCE);
}

export function signGrantToken(
  env: McpEnv,
  principal: McpPrincipal,
): Promise<string> {
  return signPrincipalToken(env, principal, GRANT_AUDIENCE, GRANT_TTL_SECONDS);
}

export function verifyGrantToken(
  env: McpEnv,
  token: string,
): Promise<McpPrincipal | null> {
  return verifyPrincipalToken(env, token, GRANT_AUDIENCE);
}

export const GRANT_TTL = GRANT_TTL_SECONDS;

/**
 * Mints the short-lived Supabase access token a verified grant executes
 * with. Claims mirror a real session token so PostgREST switches to the
 * `authenticated` role and `auth.uid()` resolves to the member.
 */
export async function signSupabaseAccessToken(
  env: McpEnv,
  principal: McpPrincipal,
): Promise<string> {
  return new SignJWT({
    role: "authenticated",
    email: principal.email ?? undefined,
    is_anonymous: false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(principal.userId)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(
      Math.floor(Date.now() / 1000) + SUPABASE_JWT_TTL_SECONDS,
    )
    .sign(secretKey(env.SUPABASE_JWT_SECRET));
}
