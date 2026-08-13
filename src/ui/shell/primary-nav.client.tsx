"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <nav
      className="sticky bottom-0 z-10 row-start-2 grid grid-cols-5 bg-card shadow-[0_-4px_16px_rgba(90,70,50,0.08)] lg:static lg:col-start-1 lg:row-start-2 lg:flex lg:self-stretch lg:flex-col lg:justify-start lg:border-r lg:bg-sidebar lg:p-2 lg:shadow-none"
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
              "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 font-heading text-xs font-semibold text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-4 lg:text-sm",
              // Selection carries on three channels — fill, ring and a
              // positional bar — because the palette alone resolves to a hue
              // shift well under the 3:1 non-text contrast floor.
              isActive &&
                "bg-secondary font-black text-foreground ring-1 ring-primary/50 before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-[3px] before:rounded-full before:bg-primary lg:before:inset-x-auto lg:before:inset-y-2 lg:before:top-auto lg:before:left-0 lg:before:h-auto lg:before:w-[3px]",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon />
            <span>{destination.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
