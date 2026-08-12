import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SIGN_IN_PATH } from "@/lib/auth/paths";
import { GateShell } from "@/ui/layout/gate-shell";

export default function AuthErrorPage() {
  return (
    <GateShell
      description="Ask your household administrator for a new enrollment or recovery link."
      title="Sign-in link invalid"
      titleId="auth-error-title"
    >
      <Button
        className="w-full"
        nativeButton={false}
        render={<Link href={SIGN_IN_PATH} />}
        variant="outline"
      >
        Back to sign in
      </Button>
    </GateShell>
  );
}
