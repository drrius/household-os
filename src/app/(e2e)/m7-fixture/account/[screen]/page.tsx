import { SecurityScreen } from "@/app/security/security-screen";
import { notFound } from "next/navigation";
import {
  AccountFixture,
  UnavailablePasskeysFixture,
} from "@/app/(e2e)/m7-fixture/account/account-fixture.client";
import { safeReturnPath } from "@/lib/auth/return-path";
import { GateShell } from "@/ui/layout/gate-shell";

export default async function AccountFixturePage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { screen } = await params;
  if (screen === "security-error" || screen === "security-pending")
    return (
      <SecurityScreen>
        <UnavailablePasskeysFixture pending={screen === "security-pending"} />
      </SecurityScreen>
    );
  if (
    ![
      "sign-in",
      "cancel",
      "sign-out",
      "sign-out-fallback",
      "sign-out-partner",
    ].includes(screen)
  )
    notFound();
  return (
    <GateShell
      title="Account flow fixture"
      titleId="account-flow-title"
      description="Controlled account interaction verification. No real passkey or household session is created."
    >
      <AccountFixture
        screen={screen}
        returnTo={safeReturnPath((await searchParams).returnTo)}
      />
    </GateShell>
  );
}
