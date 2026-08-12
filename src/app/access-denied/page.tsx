import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SIGN_IN_PATH } from "@/lib/auth/paths";
import { GateShell } from "@/ui/layout/gate-shell";

export default function AccessDeniedPage() {
  return (
    <GateShell
      description="This account is signed in but is not a member of the household. Ask the household administrator to provision membership."
      title="No household membership"
      titleId="access-denied-title"
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
