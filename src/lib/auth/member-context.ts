import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { ACCESS_DENIED_PATH, SIGN_IN_PATH } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";
import {
  asHouseholdId,
  asUserId,
  type HouseholdId,
  type UserId,
} from "@/domain/identity";

export type VerifiedIdentity = {
  userId: UserId;
  email: string | null;
};

export type HouseholdMembership = {
  householdId: HouseholdId;
  displayName: string;
};

export type MemberContext = VerifiedIdentity & HouseholdMembership;

type MembershipRow = {
  household_id: string;
  display_name: string;
};

export const getVerifiedIdentity = cache(
  async (): Promise<VerifiedIdentity | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || data?.claims?.sub === undefined) {
      return null;
    }

    const emailClaim = data.claims.email;
    const email =
      typeof emailClaim === "string" && emailClaim.length > 0
        ? emailClaim
        : null;

    return {
      userId: asUserId(data.claims.sub),
      email,
    };
  },
);

export const getMemberContext = cache(
  async (): Promise<MemberContext | null> => {
    const identity = await getVerifiedIdentity();

    if (identity === null) {
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("household_members")
      .select("household_id, display_name")
      .eq("user_id", identity.userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Membership lookup failed: ${error.message}`);
    }

    if (data === null) {
      return null;
    }

    const row = data as MembershipRow;

    return {
      ...identity,
      householdId: asHouseholdId(row.household_id),
      displayName: row.display_name,
    };
  },
);

export async function requireMemberContext(): Promise<MemberContext> {
  const identity = await getVerifiedIdentity();

  if (identity === null) {
    redirect(SIGN_IN_PATH);
  }

  const member = await getMemberContext();

  if (member === null) {
    redirect(ACCESS_DENIED_PATH);
  }

  return member;
}
