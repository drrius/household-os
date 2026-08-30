import type { ReactNode } from "react";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { SurfaceRefresh } from "@/ui/realtime/surface-refresh.client";
import { AppShell } from "@/ui/shell/app-shell";
import { FirstVisitWelcome } from "@/ui/welcome/first-visit-welcome.client";

export default async function ProductLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [
    { data: household, error },
    { data: memberRows, error: membersError },
  ] = await Promise.all([
    supabase
      .from("households")
      .select("name")
      .eq("id", member.householdId)
      .single(),
    supabase
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", member.householdId)
      .order("joined_at"),
  ]);

  if (error) {
    throw new Error(`Household name lookup failed: ${error.message}`);
  }
  if (membersError) {
    throw new Error(`Household member lookup failed: ${membersError.message}`);
  }

  return (
    <AppShell
      householdName={household.name}
      members={(memberRows ?? []).map((row) => ({
        memberId: row.user_id,
        name: row.display_name,
      }))}
    >
      <SurfaceRefresh householdId={member.householdId} />
      <FirstVisitWelcome />
      {children}
    </AppShell>
  );
}
