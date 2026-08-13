"use client";

import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";

// The warm client-router hop measured ~70ms, so a shorter delay only flashes.
const PENDING_DELAY_MS = 100;

/**
 * The client router keeps the old week on screen until the whole RSC payload
 * lands, so week navigation is otherwise silent for as long as the fetch takes.
 * `useLinkStatus` only reports inside a `<Link>` subtree, so every caller has to
 * read it from a descendant of the link it belongs to.
 */
export function useSlowLinkStatus(): boolean {
  const { pending } = useLinkStatus();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      setSlow(true);
    }, PENDING_DELAY_MS);
    // Runs when the navigation settles, which is also when the flag resets.
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [pending]);

  return slow;
}

type WeekArrowDirection = "previous" | "next";

function WeekArrowIcon({
  direction,
  onPendingChange,
}: {
  direction: WeekArrowDirection;
  onPendingChange: (pending: boolean) => void;
}) {
  const pending = useSlowLinkStatus();

  useEffect(() => {
    onPendingChange(pending);
  }, [onPendingChange, pending]);

  if (pending) {
    return (
      <LoaderCircle
        aria-hidden="true"
        className="size-4 shrink-0 animate-spin motion-reduce:animate-none motion-reduce:opacity-70"
      />
    );
  }

  const Chevron = direction === "previous" ? ChevronLeft : ChevronRight;
  return <Chevron aria-hidden="true" className="size-4 shrink-0" />;
}

export function PlanWeekArrow({
  direction,
  href,
}: {
  direction: WeekArrowDirection;
  href: string;
}) {
  // Lifted out of the link subtree so the anchor itself carries the busy state.
  const [pending, setPending] = useState(false);
  const label = direction === "previous" ? "Previous week" : "Next week";

  return (
    <Link
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      aria-label={label}
      // `size: "icon"` is already size-11 md:size-9, so the touch target is
      // 44px where it matters and matches its siblings on a pointer screen.
      className={buttonVariants({
        className: "no-underline aria-busy:opacity-70",
        size: "icon",
        variant: "outline",
      })}
      href={href}
      title={label}
    >
      <WeekArrowIcon direction={direction} onPendingChange={setPending} />
    </Link>
  );
}
