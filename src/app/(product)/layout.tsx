import type { ReactNode } from "react";

import { requireMemberContext } from "@/lib/auth/member-context";
import { AppShell } from "@/ui/shell/app-shell";

export default async function ProductLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireMemberContext();

  return <AppShell>{children}</AppShell>;
}
