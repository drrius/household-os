"use client";

import {
  CalendarCheck,
  ShoppingBasket,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GLOBAL_ADD_OPTIONS } from "@/lib/ui/destinations";
import { cn } from "@/lib/utils";
import { PlusIcon } from "@/ui/icons/app-icons";

const ADD_OPTION_ICONS = {
  routine: CalendarCheck,
  grocery: ShoppingBasket,
  meal: UtensilsCrossed,
  expense: Wallet,
} satisfies Record<(typeof GLOBAL_ADD_OPTIONS)[number]["id"], LucideIcon>;

// Dedicated create and edit surfaces already are the add flow, so the floating
// trigger only duplicates them there while covering the form's own content.
const FORM_ROUTE = /\/(?:new|edit)$/;

export function GlobalAddSheet() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isFormRoute = FORM_ROUTE.test(pathname);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            aria-label="Add something"
            className={cn(
              "fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-20 size-14 rounded-full shadow-[0_6px_20px_rgba(226,80,60,0.3)] ring-1 ring-primary lg:static lg:col-start-1 lg:row-start-3 lg:m-4 lg:h-11 lg:w-auto lg:px-4 lg:shadow-none",
              isFormRoute && "max-lg:hidden",
            )}
            size="icon-lg"
          />
        }
      >
        <PlusIcon />
        <span className="hidden lg:inline">Add something</span>
      </DialogTrigger>

      <DialogContent
        className="max-sm:top-auto max-sm:right-0 max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:gap-5 max-sm:rounded-t-3xl max-sm:rounded-b-none max-sm:p-0 max-sm:data-closed:zoom-out-100 max-sm:data-open:zoom-in-100 sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-2xl sm:gap-6 sm:overflow-y-auto sm:p-8"
        overlayClassName="bg-foreground/30 supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader className="max-sm:px-6 max-sm:pt-6 max-sm:pr-14 sm:pr-10">
          <DialogTitle className="font-heading text-xl font-semibold sm:text-2xl">
            Add something
          </DialogTitle>
          <DialogDescription className="text-base sm:text-sm">
            It lands in the right place for both of you.
          </DialogDescription>
        </DialogHeader>

        <ul
          className="grid list-none gap-3 max-sm:px-6 max-sm:pb-2 sm:grid-cols-2 sm:gap-4"
          role="list"
        >
          {GLOBAL_ADD_OPTIONS.map((option) => {
            const Icon = ADD_OPTION_ICONS[option.id];

            return (
              <li key={option.id} className="min-w-0">
                <Link
                  className="grid h-full min-h-11 gap-1 rounded-2xl border border-border bg-card p-4 no-underline outline-none hover:bg-secondary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  href={option.href}
                  onClick={() => setOpen(false)}
                >
                  <span className="flex items-center gap-2 text-base sm:text-sm">
                    <Icon
                      aria-hidden="true"
                      className="size-4 h-lh shrink-0 stroke-primary"
                    />
                    <strong className="font-heading font-semibold text-foreground">
                      {option.label}
                    </strong>
                  </span>
                  <span className="pl-6 text-base leading-snug text-pretty text-muted-foreground sm:text-sm">
                    {option.description}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="max-sm:px-6 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:justify-stretch">
          <DialogClose
            render={
              <Button className="w-full" type="button" variant="outline" />
            }
          >
            Cancel
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
