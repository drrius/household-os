import Link from "next/link";

import { signOutAction } from "@/app/access-denied/sign-out-action";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GateShell } from "@/ui/layout/gate-shell";

export default function AccessDeniedPage() {
  return (
    <GateShell
      description="This account is signed in but is not a member of the household. Ask the person who set up Our Home to add this account, then try again."
      title="No household membership"
      titleId="access-denied-title"
    >
      {/* Membership is re-read on every member-path request, so retrying is
          worth an attempt before tearing the session down. */}
      <Link
        className={cn(buttonVariants(), "h-11 w-full no-underline md:h-11")}
        href="/"
      >
        Try again
      </Link>

      <form action={signOutAction}>
        <Button className="h-11 w-full md:h-11" type="submit" variant="outline">
          Sign out and return to sign in
        </Button>
      </form>
    </GateShell>
  );
}
