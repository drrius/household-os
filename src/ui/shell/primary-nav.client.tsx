"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <nav className="app-shell__nav" aria-label="Primary navigation">
      {PRODUCT_DESTINATIONS.map((destination) => {
        const Icon = PRODUCT_DESTINATION_ICONS[destination.id];
        const isActive = isDestinationActive(pathname, destination.href);
        const className = isActive ? "nav-link nav-link--active" : "nav-link";

        return (
          <Link
            key={destination.id}
            href={destination.href}
            className={className}
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
