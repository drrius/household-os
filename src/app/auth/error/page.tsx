import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SIGN_IN_PATH } from "@/lib/auth/paths";
import { GateShell } from "@/ui/layout/gate-shell";

export default function AuthErrorPage() {
  return (
    <GateShell
      description="Ask your household administrator for a new enrollment or recovery link."
      title="Sign-in link invalid"
      titleId="auth-error-title"
    >
      <Link
        className={buttonVariants({
          className: "w-full no-underline",
          variant: "outline",
        })}
        href={SIGN_IN_PATH}
      >
        Back to sign in
      </Link>
    </GateShell>
  );
}
