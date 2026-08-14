"use client";

import { CalendarCheck, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SlowLink } from "@/ui/plan/slow-link.client";

const chipClassName = cn(
  buttonVariants({ size: "icon-sm", variant: "secondary" }),
  "shadow-sm ring-1 ring-foreground/5 no-underline sm:h-8 sm:w-auto sm:gap-1 sm:px-3",
);

export function PlanThisWeekJump({ visible }: { visible: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          animate={
            reduceMotion
              ? { opacity: 1 }
              : { opacity: 1, scale: 1, filter: "blur(0px)" }
          }
          className="flex items-center"
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
          <SlowLink
            aria-label="This week"
            className={cn(chipClassName, "aria-busy:opacity-70")}
            href="/plan"
            title="This week"
          >
            {(pending) =>
              pending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 shrink-0 animate-spin motion-reduce:animate-none motion-reduce:opacity-70"
                />
              ) : (
                <>
                  <CalendarCheck
                    aria-hidden="true"
                    className="size-4 shrink-0 sm:hidden"
                  />
                  <span className="hidden sm:inline">This week</span>
                </>
              )
            }
          </SlowLink>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
