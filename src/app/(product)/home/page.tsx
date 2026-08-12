import Link from "next/link";

import { SECURITY_PATH } from "@/lib/auth/paths";
import { AppPage } from "@/ui/primitives/app-page";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";

export default function HomePage() {
  return (
    <AppPage labelledBy="home-title">
      <PageHeader titleId="home-title" title="Our home" eyebrow="Home" />
      <EmptyState title="Household, routines, and settings">
        <p>
          Pets, areas, activity, members, and notification settings land here
          next.
        </p>
        <p>
          <Link href={SECURITY_PATH}>Passkeys and recovery</Link>
        </p>
      </EmptyState>
    </AppPage>
  );
}
