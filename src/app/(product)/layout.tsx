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
  const { data: household, error } = await supabase
    .from("households")
    .select("name")
    .eq("id", member.householdId)
    .single();

  if (error) {
    throw new Error(`Household name lookup failed: ${error.message}`);
  }

  return (
    <AppShell householdName={household.name}>
      <SurfaceRefresh householdId={member.householdId} />
      <FirstVisitWelcome />
      {children}
    </AppShell>
  );
}
