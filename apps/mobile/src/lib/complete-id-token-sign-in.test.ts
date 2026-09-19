import { describe, expect, it, vi } from "vitest";

import {
  NotAHouseholdMemberError,
  completeAppleIdTokenSignIn,
  type IdTokenAuthClient,
} from "./complete-id-token-sign-in";

function authClient(options: {
  userId?: string | null;
  signInError?: string;
}): IdTokenAuthClient & { signedOut: boolean } {
  const client = {
    signedOut: false,
    async signInWithIdToken() {
      if (options.signInError !== undefined) {
        return {
          data: { user: null },
          error: { message: options.signInError },
        };
      }
      const userId = options.userId ?? null;
      return {
        data: { user: userId === null ? null : { id: userId } },
        error: null,
      };
    },
    async signOut() {
      client.signedOut = true;
    },
  };
  return client;
}

describe("completeAppleIdTokenSignIn", () => {
  it("exchanges the Apple token and admits an existing member", async () => {
    const auth = authClient({ userId: "user-1" });
    const loadMembership = vi.fn().mockResolvedValue({
      householdId: "household-1",
      displayName: "Alex",
    });

    await expect(
      completeAppleIdTokenSignIn({
        token: "apple-id-token",
        auth,
        loadMembership,
      }),
    ).resolves.toEqual({
      householdId: "household-1",
      userId: "user-1",
      displayName: "Alex",
    });
    expect(loadMembership).toHaveBeenCalledWith("user-1");
    expect(auth.signedOut).toBe(false);
  });

  it("signs out and fails closed when the Apple user has no membership", async () => {
    const auth = authClient({ userId: "stranger" });

    await expect(
      completeAppleIdTokenSignIn({
        token: "apple-id-token",
        auth,
        loadMembership: async () => null,
      }),
    ).rejects.toBeInstanceOf(NotAHouseholdMemberError);
    expect(auth.signedOut).toBe(true);
  });

  it("does not leave a session when sign-in returns no user", async () => {
    const auth = authClient({ userId: null });

    await expect(
      completeAppleIdTokenSignIn({
        token: "apple-id-token",
        auth,
        loadMembership: async () => {
          throw new Error("should not load membership");
        },
      }),
    ).rejects.toBeInstanceOf(NotAHouseholdMemberError);
    expect(auth.signedOut).toBe(true);
  });

  it("surfaces the Supabase error and does not sign out", async () => {
    const auth = authClient({ signInError: "Invalid id_token" });

    await expect(
      completeAppleIdTokenSignIn({
        token: "bad-token",
        auth,
        loadMembership: async () => null,
      }),
    ).rejects.toThrow("Invalid id_token");
    expect(auth.signedOut).toBe(false);
  });
});
