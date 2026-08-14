import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SIGN_IN_PATH } from "@/lib/auth/paths";
import { cn } from "@/lib/utils";
import { GateShell } from "@/ui/layout/gate-shell";

// The route that redirects here knows why the link failed. Neither branch ever
// surfaces the identity provider's own error text.
const REASON_COPY = {
  malformed:
    "This link is incomplete, usually from a copy/paste that dropped part of the address. Ask for a fresh link and open it directly.",
  rejected:
    "This link can no longer be used. Enrollment and recovery links work once and expire, so opening it again will not help. Ask the person who set up Our Home for a new link.",
} as const;

type AuthErrorPageProps = {
  searchParams: Promise<{ reason?: string | string[] }>;
};

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const { reason } = await searchParams;

  return (
    <GateShell
      description={
        reason === "malformed" ? REASON_COPY.malformed : REASON_COPY.rejected
      }
      title="Sign-in link invalid"
      titleId="auth-error-title"
    >
      <Link
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-11 w-full no-underline md:h-11",
        )}
        href={SIGN_IN_PATH}
      >
        Back to sign in
      </Link>
      <p className="text-sm text-muted-foreground">
        Already set up a passkey on this device? Go back to sign in.
      </p>
    </GateShell>
  );
}
