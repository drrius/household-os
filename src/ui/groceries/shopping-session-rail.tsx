import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { GroceryMutationButton } from "./mutation-button.client";

type LiveSession = NonNullable<GroceriesViewModel["liveSession"]>;

export function ShoppingSessionRail({
  joinAction,
  session,
}: {
  joinAction: () => Promise<void>;
  session: LiveSession;
}) {
  return (
    <section
      aria-label="Shopping now"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-success-soft px-4 py-3"
    >
      <div className="grid gap-1">
        <p className="font-semibold text-success">
          {session.isMine ? "Your cart" : `${session.memberName} is shopping`}
        </p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {session.claimedCount} {session.claimedCount === 1 ? "item" : "items"}{" "}
          in cart
        </p>
      </div>
      {session.isMine ? (
        <Link
          className={buttonVariants({
            variant: "outline",
            className: "min-h-11 no-underline",
          })}
          href="/groceries/checkout"
        >
          {session.claimedCount > 0 ? "Finish shopping" : "Manage session"}
        </Link>
      ) : (
        <GroceryMutationButton
          action={joinAction}
          label="Start my cart"
          successMessage="Your cart is ready"
        />
      )}
    </section>
  );
}
