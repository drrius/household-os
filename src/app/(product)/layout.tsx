import type { ReactNode } from "react";

import { requireMemberContext } from "@/lib/auth/member-context";
import { SurfaceRefresh } from "@/ui/realtime/surface-refresh.client";
import { AppShell } from "@/ui/shell/app-shell";

export default async function ProductLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const member = await requireMemberContext();

  return (
    <AppShell>
      <SurfaceRefresh householdId={member.householdId} />
      {children}
    </AppShell>
  );
}
