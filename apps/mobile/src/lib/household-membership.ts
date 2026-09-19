import { supabase } from "./supabase";

export async function loadHouseholdMembership(userId: string): Promise<{
  householdId: string;
  displayName: string;
} | null> {
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data === null) {
    return null;
  }

  return {
    householdId: data.household_id as string,
    displayName: (data.display_name as string) ?? "",
  };
}
