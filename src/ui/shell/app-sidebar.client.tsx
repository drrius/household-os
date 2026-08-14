"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { PRODUCT_DESTINATIONS } from "@/lib/ui/destinations";
import { PRODUCT_DESTINATION_ICONS } from "@/ui/icons/app-icons";
import { GlobalAddSheet } from "@/ui/shell/global-add-sheet.client";

type AppSidebarProps = {
  householdName: string;
};

function isDestinationActive(pathname: string, destinationHref: string) {
  const fixturePath =
    destinationHref === "/"
      ? "/m6-fixture/today"
      : `/m6-fixture${destinationHref}`;
  if (pathname === fixturePath) {
    return true;
  }

  if (destinationHref === "/") {
    return pathname === destinationHref;
  }

  return (
    pathname === destinationHref || pathname.startsWith(`${destinationHref}/`)
  );
}

export function AppSidebar({ householdName }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="hidden lg:contents">
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              className="flex min-w-0 flex-1 items-center gap-3 no-underline group-data-[collapsible=icon]:hidden"
              href="/"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center"
                aria-hidden="true"
              >
                <Image
                  alt=""
                  className="h-auto w-full"
                  height={46}
                  priority
                  src="/brand/birds-building-nest.png"
                  width={80}
                />
              </span>
              <span className="line-clamp-2 min-w-0 font-heading text-sm leading-tight font-bold group-data-[collapsible=icon]:hidden">
                {householdName}
              </span>
            </Link>
            <SidebarTrigger className="shrink-0" />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <nav aria-label="Primary navigation">
            <SidebarGroup>
              <SidebarGroupLabel>Household</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {PRODUCT_DESTINATIONS.map((destination) => {
                    const Icon = PRODUCT_DESTINATION_ICONS[destination.id];
                    const isActive = isDestinationActive(
                      pathname,
                      destination.href,
                    );

                    return (
                      <SidebarMenuItem key={destination.id}>
                        <SidebarMenuButton
                          aria-current={isActive ? "page" : undefined}
                          className="font-heading font-semibold data-active:font-semibold"
                          isActive={isActive}
                          render={<Link href={destination.href} />}
                          title={destination.label}
                        >
                          <Icon />
                          <span>{destination.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </nav>
        </SidebarContent>

        <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
          <GlobalAddSheet placement="sidebar" />
        </SidebarFooter>
        <SidebarRail className="w-6" />
      </Sidebar>
    </div>
  );
}
