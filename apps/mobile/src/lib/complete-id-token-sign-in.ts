import { existingMemberOrDenied } from "../../../../src/domain/identity";

export class NotAHouseholdMemberError extends Error {
  readonly name = "NotAHouseholdMemberError";

  constructor() {
    super(
      "This Apple ID is not a household member. Sign-in was closed so a new account cannot open the home.",
    );
  }
}

export type IdTokenAuthClient = {
  signInWithIdToken: (args: { provider: "apple"; token: string }) => Promise<{
    data: { user: { id: string } | null };
    error: { message: string } | null;
  }>;
  signOut: () => Promise<unknown>;
};

export type MembershipLoader = (userId: string) => Promise<{
  householdId: string;
  displayName: string;
} | null>;

export async function completeAppleIdTokenSignIn(input: {
  token: string;
  auth: IdTokenAuthClient;
  loadMembership: MembershipLoader;
}): Promise<{ householdId: string; userId: string; displayName: string }> {
  const { data, error } = await input.auth.signInWithIdToken({
    provider: "apple",
    token: input.token,
  });

  if (error) {
    throw new Error(error.message);
  }

  const userId = data.user?.id;
  if (userId === undefined) {
    await input.auth.signOut();
    throw new NotAHouseholdMemberError();
  }

  const membership = existingMemberOrDenied(await input.loadMembership(userId));
  if (membership === null) {
    await input.auth.signOut();
    throw new NotAHouseholdMemberError();
  }

  return {
    householdId: membership.householdId,
    userId,
    displayName: membership.displayName,
  };
}
