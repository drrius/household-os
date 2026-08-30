import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isRedirectUriAllowed,
  signAuthorizationCode,
  signGrantToken,
  signSupabaseAccessToken,
  verifyAuthorizationCode,
  verifyGrantToken,
  type McpEnv,
} from "./tokens";

const env: McpEnv = {
  MCP_GRANT_SECRET: "test-grant-secret-with-enough-entropy-123456",
  SUPABASE_JWT_SECRET: "test-supabase-secret-with-enough-entropy-1",
  MCP_ALLOWED_REDIRECT_ORIGINS:
    "https://household-mcp.example.workers.dev, http://localhost:8788",
};

const principal = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "member@example.com",
  displayName: "Darius",
};

describe("MCP tokens", () => {
  it("round-trips an authorization code", async () => {
    const code = await signAuthorizationCode(env, principal);
    expect(await verifyAuthorizationCode(env, code)).toEqual(principal);
  });

  it("round-trips a grant token", async () => {
    const grant = await signGrantToken(env, principal);
    expect(await verifyGrantToken(env, grant)).toEqual(principal);
  });

  it("never accepts a code where a grant is required, or vice versa", async () => {
    const code = await signAuthorizationCode(env, principal);
    const grant = await signGrantToken(env, principal);
    expect(await verifyGrantToken(env, code)).toBeNull();
    expect(await verifyAuthorizationCode(env, grant)).toBeNull();
  });

  it("rejects tampered and wrong-secret tokens", async () => {
    const grant = await signGrantToken(env, principal);
    expect(await verifyGrantToken(env, `${grant}x`)).toBeNull();
    const otherEnv: McpEnv = {
      ...env,
      MCP_GRANT_SECRET: "a-completely-different-secret-value-9876543210",
    };
    expect(await verifyGrantToken(otherEnv, grant)).toBeNull();
  });

  it("mints a Supabase token carrying the member as sub", async () => {
    const token = await signSupabaseAccessToken(env, principal);
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    expect(payload.sub).toBe(principal.userId);
    expect(payload.role).toBe("authenticated");
    expect(payload.aud).toBe("authenticated");
    expect(typeof payload.exp).toBe("number");
  });

  it("only allows exact redirect origins from the allowlist", () => {
    expect(
      isRedirectUriAllowed(
        env,
        "https://household-mcp.example.workers.dev/callback",
      ),
    ).toBe(true);
    expect(isRedirectUriAllowed(env, "http://localhost:8788/callback")).toBe(
      true,
    );
    expect(isRedirectUriAllowed(env, "https://evil.example.com/callback")).toBe(
      false,
    );
    expect(
      isRedirectUriAllowed(
        env,
        "https://household-mcp.example.workers.dev.evil.com/callback",
      ),
    ).toBe(false);
    expect(isRedirectUriAllowed(env, "not-a-url")).toBe(false);
  });
});
