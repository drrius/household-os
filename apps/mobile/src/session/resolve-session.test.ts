import { describe, expect, it } from "vitest";

import { resolveAuthenticatedSession } from "./resolve-session";

describe("resolveAuthenticatedSession", () => {
  it("stays signed out when there is no auth user", async () => {
    let signedOut = false;
    await expect(
      resolveAuthenticatedSession({
        getUserId: async () => null,
        loadMembership: async () => {
          throw new Error("should not load");
        },
        signOut: async () => {
          signedOut = true;
        },
      }),
    ).resolves.toEqual({ status: "signed-out" });
    expect(signedOut).toBe(false);
  });

  it("admits an existing household member", async () => {
    await expect(
      resolveAuthenticatedSession({
        getUserId: async () => "user-1",
        loadMembership: async (userId) =>
          userId === "user-1"
            ? { householdId: "household-1", displayName: "Alex" }
            : null,
        signOut: async () => {
          throw new Error("should not sign out");
        },
      }),
    ).resolves.toEqual({
      status: "ready",
      householdId: "household-1",
      userId: "user-1",
      displayName: "Alex",
    });
  });

  it("signs out and fails closed when the auth user is not a member", async () => {
    let signedOut = false;
    await expect(
      resolveAuthenticatedSession({
        getUserId: async () => "stranger",
        loadMembership: async () => null,
        signOut: async () => {
          signedOut = true;
        },
      }),
    ).resolves.toEqual({ status: "not-a-member" });
    expect(signedOut).toBe(true);
  });
});
