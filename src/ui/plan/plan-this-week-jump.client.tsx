"use client";

import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SlowLink } from "@/ui/plan/slow-link.client";

const chipClassName = cn(
  buttonVariants({ size: "sm", variant: "secondary" }),
  "shadow-sm ring-1 ring-foreground/5 no-underline",
);

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
            <SlowLink className={chipClassName} href="/plan">
              {(pending) => (
                <>
                  This week
                  <JumpSpinner pending={pending} />
                </>
              )}
            </SlowLink>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
