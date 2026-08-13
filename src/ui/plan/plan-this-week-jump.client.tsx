"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const chipClassName = cn(
  buttonVariants({ size: "sm", variant: "secondary" }),
  "shadow-sm ring-1 ring-foreground/5 no-underline",
);

export function PlanThisWeekJump({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className={cn(chipClassName, "invisible pointer-events-none")}
      >
        This week
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
            <Link className={chipClassName} href="/plan">
              This week
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
