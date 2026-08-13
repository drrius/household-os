import type { ReactNode } from "react";

import { requireMemberContext } from "@/lib/auth/member-context";
import { SurfaceRefresh } from "@/ui/realtime/surface-refresh.client";
import { AppShell } from "@/ui/shell/app-shell";
import { FirstVisitWelcome } from "@/ui/welcome/first-visit-welcome.client";

export default async function ProductLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const member = await requireMemberContext();

  return (
    <AppShell>
      <SurfaceRefresh householdId={member.householdId} />
      <FirstVisitWelcome />
      {children}
    </AppShell>
  );
}
