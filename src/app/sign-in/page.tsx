import { redirect } from "next/navigation";

import { SignInForm } from "@/app/sign-in/sign-in-form";
import {
  getMemberContext,
  getVerifiedIdentity,
} from "@/lib/auth/member-context";
import { ACCESS_DENIED_PATH } from "@/lib/auth/paths";
import { GateShell } from "@/ui/layout/gate-shell";

export default async function SignInPage() {
  const identity = await getVerifiedIdentity();

  if (identity !== null) {
    const member = await getMemberContext();
    redirect(member === null ? ACCESS_DENIED_PATH : "/");
  }

  return (
    <GateShell
      description="Use a discoverable passkey. No email is collected here."
      title="Sign in"
      titleId="sign-in-title"
    >
      <SignInForm />
    </GateShell>
  );
}
