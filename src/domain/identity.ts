export type UserId = string & { readonly __brand: "UserId" };
export type HouseholdId = string & { readonly __brand: "HouseholdId" };

export const VERSION_ONE_MEMBER_CAP = 2;

export function asUserId(value: string): UserId {
  if (value.length === 0) {
    throw new Error("UserId must be a non-empty string");
  }

  return value as UserId;
}

export function asHouseholdId(value: string): HouseholdId {
  if (value.length === 0) {
    throw new Error("HouseholdId must be a non-empty string");
  }

  return value as HouseholdId;
}

export function canAdmitMember(currentMemberCount: number): boolean {
  if (!Number.isSafeInteger(currentMemberCount) || currentMemberCount < 0) {
    throw new Error("currentMemberCount must be a non-negative safe integer");
  }

  return currentMemberCount < VERSION_ONE_MEMBER_CAP;
}

export type HouseholdMembershipSnapshot = {
  householdId: string;
  displayName: string;
};

export type ExistingMember = {
  householdId: HouseholdId;
  displayName: string;
};

/** Admit only an already-linked household member. Never invents a household. */
export function existingMemberOrDenied(
  membership: HouseholdMembershipSnapshot | null | undefined,
): ExistingMember | null {
  if (membership === null || membership === undefined) {
    return null;
  }

  if (membership.householdId.length === 0) {
    return null;
  }

  return {
    householdId: asHouseholdId(membership.householdId),
    displayName: membership.displayName,
  };
}

export type AppleAttachDecision =
  | { kind: "delete-orphan" }
  | { kind: "needs-transfer" }
  | { kind: "refuse"; reason: string };

/**
 * Plan how to attach an Apple identity to an existing member without
 * creating a household or a third membership.
 */
export function planAppleIdentityAttach(input: {
  memberUserIds: readonly string[];
  memberUserId: string;
  orphanUserId: string;
  memberAppleProviderId: string | null;
  orphanAppleProviderId: string | null;
  extraNonMemberUserIds: readonly string[];
}): AppleAttachDecision {
  if (input.memberUserIds.length !== VERSION_ONE_MEMBER_CAP) {
    return {
      kind: "refuse",
      reason: "attach-apple requires exactly two household members",
    };
  }

  if (!input.memberUserIds.includes(input.memberUserId)) {
    return {
      kind: "refuse",
      reason: "Target user is not a household member",
    };
  }

  if (input.orphanUserId === input.memberUserId) {
    return {
      kind: "refuse",
      reason: "Orphan user must be distinct from the member",
    };
  }

  if (input.memberUserIds.includes(input.orphanUserId)) {
    return {
      kind: "refuse",
      reason: "Refusing to treat a household member as the Apple orphan",
    };
  }

  if (input.extraNonMemberUserIds.length > 0) {
    return {
      kind: "refuse",
      reason:
        "Refusing attach-apple while extra non-member auth users exist besides the named orphan",
    };
  }

  if (
    input.orphanAppleProviderId === null ||
    input.orphanAppleProviderId.length === 0
  ) {
    return {
      kind: "refuse",
      reason: "Orphan user has no Apple identity",
    };
  }

  if (
    input.memberAppleProviderId !== null &&
    input.memberAppleProviderId.length > 0 &&
    input.memberAppleProviderId !== input.orphanAppleProviderId
  ) {
    return {
      kind: "refuse",
      reason: "Member already has a different Apple identity",
    };
  }

  if (input.memberAppleProviderId === input.orphanAppleProviderId) {
    return { kind: "delete-orphan" };
  }

  return { kind: "needs-transfer" };
}
