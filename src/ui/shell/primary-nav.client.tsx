"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  PRODUCT_DESTINATIONS,
  type ProductDestinationId,
} from "@/lib/ui/destinations";
import { PRODUCT_DESTINATION_ICONS } from "@/ui/icons/app-icons";

function destinationFromPath(pathname: string): ProductDestinationId {
  if (pathname === "/" || pathname === "") {
    return "today";
  }

  if (pathname === "/plan" || pathname.startsWith("/plan/")) {
    return "plan";
  }

  if (pathname === "/groceries" || pathname.startsWith("/groceries/")) {
    return "groceries";
  }

  if (pathname === "/money" || pathname.startsWith("/money/")) {
    return "money";
  }

  if (pathname === "/home" || pathname.startsWith("/home/")) {
    return "home";
  }

  return "today";
}

export function PrimaryNav() {
  const pathname = usePathname();
  const active = destinationFromPath(pathname);

  return (
    <nav className="app-shell__nav" aria-label="Primary">
      {PRODUCT_DESTINATIONS.map((destination) => {
        const Icon = PRODUCT_DESTINATION_ICONS[destination.id];
        const isActive = destination.id === active;
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
