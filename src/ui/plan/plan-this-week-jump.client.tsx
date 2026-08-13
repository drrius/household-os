"use client";

import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSlowLinkStatus } from "@/ui/plan/plan-week-arrow.client";

const chipClassName = cn(
  buttonVariants({ size: "sm", variant: "secondary" }),
  "shadow-sm ring-1 ring-foreground/5 no-underline",
);

/**
 * Always rendered so the chip never changes width mid-navigation, and so the
 * invisible spacer behind it reserves the same box.
 */
function JumpSpinner({ pending }: { pending: boolean }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn(
        "size-3 shrink-0 animate-spin transition-opacity motion-reduce:animate-none motion-reduce:transition-none",
        pending ? "opacity-100 motion-reduce:opacity-70" : "opacity-0",
      )}
    />
  );
}

function JumpSpinnerSlot({
  onPendingChange,
}: {
  onPendingChange: (pending: boolean) => void;
}) {
  const pending = useSlowLinkStatus();

  useEffect(() => {
    onPendingChange(pending);
  }, [onPendingChange, pending]);

  return <JumpSpinner pending={pending} />;
}

function JumpLink() {
  // Lifted out of the link subtree so the anchor itself carries the busy state.
  const [pending, setPending] = useState(false);

  return (
    <Link
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      className={cn(chipClassName, "aria-busy:opacity-70")}
      href="/plan"
    >
      This week
      <JumpSpinnerSlot onPendingChange={setPending} />
    </Link>
  );
}

export function PlanThisWeekJump({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className={cn(chipClassName, "invisible pointer-events-none")}
      >
        This week
        <JumpSpinner pending={false} />
      </span>
      <AnimatePresence>
        {visible ? (
          <motion.div
            animate={
              reduceMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, filter: "blur(0px)" }
            }
            className="absolute inset-0 flex items-center"
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, filter: "blur(4px)" }
            }
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, filter: "blur(4px)" }
            }
            key="this-week-jump"
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 420, damping: 28, mass: 0.7 }
            }
          >
            <JumpLink />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
