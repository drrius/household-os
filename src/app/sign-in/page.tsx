import { redirect } from "next/navigation";

import { SignInForm } from "@/app/sign-in/sign-in-form";
import {
  getMemberContext,
  getVerifiedIdentity,
} from "@/lib/auth/member-context";
import { ACCESS_DENIED_PATH } from "@/lib/auth/paths";

export default async function SignInPage() {
  const identity = await getVerifiedIdentity();

  if (identity !== null) {
    const member = await getMemberContext();
    redirect(member === null ? ACCESS_DENIED_PATH : "/");
  }

  return (
    <main>
      <h1>Sign in</h1>
      <p>Use a discoverable passkey. No email is collected here.</p>
      <SignInForm />
    </main>
  );
}
