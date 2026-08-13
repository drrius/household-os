"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PlanThisWeekJump({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute top-0 right-full bottom-0 mr-2 flex items-center">
      <AnimatePresence>
        {visible ? (
          <motion.div
            animate={
              reduceMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }
            }
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, x: 8, filter: "blur(4px)" }
            }
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, x: 8, filter: "blur(4px)" }
            }
            key="this-week-jump"
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 420, damping: 28, mass: 0.7 }
            }
          >
            <Link
              className={cn(
                buttonVariants({ size: "sm", variant: "secondary" }),
                "pointer-events-auto shadow-sm ring-1 ring-foreground/5 no-underline",
              )}
              href="/plan"
            >
              This week
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
