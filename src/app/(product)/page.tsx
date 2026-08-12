import Link from "next/link";

import { requireMemberContext } from "@/lib/auth/member-context";
import { SECURITY_PATH } from "@/lib/auth/paths";
import { AppPage } from "@/ui/primitives/app-page";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";

export default async function TodayPage() {
  const member = await requireMemberContext();

  return (
    <AppPage labelledBy="today-title">
      <PageHeader
        titleId="today-title"
        title={`Hoi ${member.displayName}`}
        eyebrow="Today"
      />
      <EmptyState title="Your day is taking shape">
        <p>
          Overdue work, routines, meals, shopping, and money needing attention
          will land here next.
        </p>
        <p>
          <Link href={SECURITY_PATH}>Security</Link>
        </p>
      </EmptyState>
    </AppPage>
  );
}
