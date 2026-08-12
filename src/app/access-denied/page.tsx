import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/access-denied/sign-out-action";
import { GateShell } from "@/ui/layout/gate-shell";

export default function AccessDeniedPage() {
  return (
    <GateShell
      description="This account is signed in but is not a member of the household. Ask the household administrator to provision membership."
      title="No household membership"
      titleId="access-denied-title"
    >
      <form action={signOutAction}>
        <Button className="w-full" type="submit" variant="outline">
          Sign out and return to sign in
        </Button>
      </form>
    </GateShell>
  );
}
