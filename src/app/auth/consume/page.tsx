import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { consumeMagicLink } from "@/app/auth/consume/consume-link-action";
import { Button, buttonVariants } from "@/components/ui/button";
import { AUTH_ERROR_PATH, SIGN_IN_PATH } from "@/lib/auth/paths";
import { cn } from "@/lib/utils";
import { GateShell } from "@/ui/layout/gate-shell";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

type ConsumeLinkPageProps = {
  searchParams: Promise<{
    token_hash?: string | string[];
    type?: string | string[];
  }>;
};

export default async function ConsumeLinkPage({
  searchParams,
}: ConsumeLinkPageProps) {
  const { token_hash: tokenHash, type } = await searchParams;

  if (
    typeof tokenHash !== "string" ||
    tokenHash.length === 0 ||
    type !== "magiclink"
  ) {
    redirect(`${AUTH_ERROR_PATH}?reason=malformed`);
  }

  return (
    <GateShell
      description={
        <div className="grid gap-2 text-base sm:text-sm">
          <p className="text-pretty">
            This one-time link has not been used yet. Continue when you are
            ready to register a passkey on this device.
          </p>
          <p className="text-pretty">
            On iPhone, open this page in Safari, then save the passkey with Face
            ID and iCloud Keychain.
          </p>
        </div>
      }
      title="Set up your passkey"
      titleId="consume-link-title"
    >
      <form action={consumeMagicLink}>
        <input name="token_hash" type="hidden" value={tokenHash} />
        <input name="type" type="hidden" value="magiclink" />
        <Button className="w-full" type="submit">
          Continue to passkey setup
        </Button>
      </form>

      <Link
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full no-underline",
        )}
        href={SIGN_IN_PATH}
      >
        Cancel and return to sign in
      </Link>
    </GateShell>
  );
}
