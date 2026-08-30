"use client";

import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { SlowLink } from "@/ui/plan/slow-link.client";

type WeekArrowDirection = "previous" | "next";

export function PlanWeekArrow({
  direction,
  href,
  rangeLabel,
}: {
  direction: WeekArrowDirection;
  href: string;
  rangeLabel: string;
}) {
  // The icon alone never says where it lands, so the week goes in the name.
  const label = `${direction === "previous" ? "Previous week" : "Next week"}, ${rangeLabel}`;

  return (
    <SlowLink
      aria-label={label}
      className={buttonVariants({
        className: "no-underline aria-busy:opacity-70",
        size: "icon",
        variant: "outline",
      })}
      href={href}
      title={label}
    >
      {(pending) => {
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
      }}
    </SlowLink>
  );
}
