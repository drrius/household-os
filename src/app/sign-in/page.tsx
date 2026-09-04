import { redirect } from "next/navigation";

import { SignInForm } from "@/app/sign-in/sign-in-form";
import {
  getMemberContext,
  getVerifiedIdentity,
} from "@/lib/auth/member-context";
import { ACCESS_DENIED_PATH } from "@/lib/auth/paths";
import { safeReturnPath } from "@/lib/auth/return-path";
import { GateShell } from "@/ui/layout/gate-shell";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const returnTo = safeReturnPath((await searchParams).returnTo);
  const identity = await getVerifiedIdentity();

  if (identity !== null) {
    const member = await getMemberContext();
    redirect(member === null ? ACCESS_DENIED_PATH : returnTo);
  }

  return (
    <GateShell
      description={
        <>
          <p>
            Sign in with the passkey saved on this device or your phone. No
            password and no email.
          </p>
          <p className="mt-2">
            New device, or lost your passkey? Ask the person who set up Our Home
            for a one-time enrollment link.
          </p>
        </>
      }
      title="Sign in"
      titleId="sign-in-title"
    >
      <SignInForm returnTo={returnTo} />
    </GateShell>
  );
}
