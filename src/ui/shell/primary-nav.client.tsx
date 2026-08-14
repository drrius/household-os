"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { PRODUCT_DESTINATIONS } from "@/lib/ui/destinations";
import { PRODUCT_DESTINATION_ICONS } from "@/ui/icons/app-icons";

function isDestinationActive(pathname: string, destinationHref: string) {
  if (destinationHref === "/") {
    return pathname === destinationHref;
  }

  return (
    pathname === destinationHref || pathname.startsWith(`${destinationHref}/`)
  );
}

export function PrimaryNav() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <nav
      className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-10 grid grid-cols-5 rounded-2xl bg-card/95 p-1.5 shadow-[0_8px_32px_rgba(90,70,50,0.14)] ring-1 ring-foreground/8 supports-backdrop-filter:backdrop-blur-xl lg:static lg:col-start-1 lg:row-start-2 lg:flex lg:self-stretch lg:flex-col lg:justify-start lg:rounded-none lg:border-r lg:bg-sidebar lg:p-2 lg:shadow-none lg:ring-0 lg:backdrop-blur-none"
      aria-label="Primary navigation"
    >
      {PRODUCT_DESTINATIONS.map((destination) => {
        const Icon = PRODUCT_DESTINATION_ICONS[destination.id];
        const isActive = isDestinationActive(pathname, destination.href);

        return (
          <Link
            key={destination.id}
            href={destination.href}
            className={cn(
              "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 font-heading text-[0.6875rem] font-semibold text-muted-foreground no-underline hover:bg-muted/70 hover:text-foreground [&>svg]:relative [&>svg]:z-1 lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-2 lg:text-sm",
              isActive && "text-secondary-foreground lg:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive ? (
              <motion.span
                className="absolute inset-0 rounded-xl bg-secondary ring-1 ring-primary/15"
                layoutId="primary-navigation-selection"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 38 }
                }
              />
            ) : null}
            <Icon />
            <span className="relative z-1">{destination.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
