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
