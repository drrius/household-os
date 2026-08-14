import { describe, expect, it } from "vitest";

import { authenticatePushDispatch } from "../supabase/functions/_shared/push-dispatch-auth";

function environment(
  values: Record<string, string>,
): (name: string) => string | undefined {
  return (name) => values[name];
}

function request(headers: HeadersInit = {}): Request {
  return new Request("https://example.invalid/functions/v1/push-dispatch", {
    method: "POST",
    headers,
  });
}

describe("push-dispatch service authentication", () => {
  it("accepts every hosted named secret key from the apikey header", () => {
    const readEnvironment = environment({
      SUPABASE_SECRET_KEYS: JSON.stringify({
        default: "sb_secret_default",
        automations: "sb_secret_automations",
      }),
    });

    expect(
      authenticatePushDispatch(
        request({ apikey: "sb_secret_automations" }),
        readEnvironment,
      ),
    ).toEqual({ credential: "sb_secret_automations" });
  });

  it("accepts local and legacy service credentials", () => {
    expect(
      authenticatePushDispatch(
        request({ apikey: "local-secret" }),
        environment({ SUPABASE_SECRET_KEY: "local-secret" }),
      ),
    ).toEqual({ credential: "local-secret" });
    expect(
      authenticatePushDispatch(
        request({ apikey: "legacy-service-role" }),
        environment({ SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role" }),
      ),
    ).toEqual({ credential: "legacy-service-role" });
  });

  it("rejects a member JWT and never treats Authorization as service auth", () => {
    expect(
      authenticatePushDispatch(
        request({
          Authorization: "Bearer member-jwt",
          apikey: "sb_publishable_browser",
        }),
        environment({ SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role" }),
      ),
    ).toBeNull();
  });

  it("rejects publishable, unknown, missing, and malformed configured keys", () => {
    const readEnvironment = environment({
      SUPABASE_SECRET_KEYS: "not-json",
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({
        default: "sb_publishable_default",
      }),
    });

    expect(
      authenticatePushDispatch(
        request({ apikey: "sb_publishable_default" }),
        readEnvironment,
      ),
    ).toBeNull();
    expect(
      authenticatePushDispatch(request({ apikey: "unknown" }), readEnvironment),
    ).toBeNull();
    expect(authenticatePushDispatch(request(), readEnvironment)).toBeNull();
  });
});
