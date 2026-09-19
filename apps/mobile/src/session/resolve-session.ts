import { existingMemberOrDenied } from "../../../../src/domain/identity";

export type ResolvedSession =
  | { status: "signed-out" }
  | { status: "not-a-member" }
  | {
      status: "ready";
      householdId: string;
      userId: string;
      displayName: string;
    };

export async function resolveAuthenticatedSession(input: {
  getUserId: () => Promise<string | null>;
  loadMembership: (userId: string) => Promise<{
    householdId: string;
    displayName: string;
  } | null>;
  signOut: () => Promise<unknown>;
}): Promise<ResolvedSession> {
  const userId = await input.getUserId();
  if (userId === null) {
    return { status: "signed-out" };
  }

  const membership = existingMemberOrDenied(await input.loadMembership(userId));
  if (membership === null) {
    await input.signOut();
    return { status: "not-a-member" };
  }

  return {
    status: "ready",
    householdId: membership.householdId,
    userId,
    displayName: membership.displayName,
  };
}
