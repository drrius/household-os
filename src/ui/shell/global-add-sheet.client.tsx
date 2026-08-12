"use client";

import {
  CalendarCheck,
  ShoppingBasket,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
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
import { PlusIcon } from "@/ui/icons/app-icons";

const ADD_OPTION_ICONS = {
  routine: CalendarCheck,
  grocery: ShoppingBasket,
  meal: UtensilsCrossed,
  expense: Wallet,
} satisfies Record<(typeof GLOBAL_ADD_OPTIONS)[number]["id"], LucideIcon>;

export function GlobalAddSheet() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            aria-label="Add something"
            className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-20 size-14 rounded-full shadow-[0_6px_20px_rgba(226,80,60,0.3)] ring-1 ring-primary lg:static lg:col-start-1 lg:row-start-3 lg:m-4 lg:h-11 lg:w-auto lg:px-4 lg:shadow-none"
            size="icon-lg"
          />
        }
      >
        <PlusIcon />
        <span className="hidden lg:inline">Add something</span>
      </DialogTrigger>

      <DialogContent
        className="max-lg:top-auto max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:max-w-none max-lg:translate-x-0 max-lg:translate-y-0 max-lg:gap-5 max-lg:rounded-b-none max-lg:rounded-t-3xl max-lg:p-0 max-lg:data-closed:zoom-out-100 max-lg:data-open:zoom-in-100 lg:max-w-2xl lg:gap-6 lg:p-8"
        overlayClassName="bg-foreground/30 supports-backdrop-filter:backdrop-blur-sm"
      >
        <DialogHeader className="max-lg:px-6 max-lg:pt-6 max-lg:pr-14 lg:pr-10">
          <DialogTitle className="font-heading text-xl font-semibold lg:text-2xl">
            Add something
          </DialogTitle>
          <DialogDescription className="text-base sm:text-sm">
            It lands in the right place for both of you.
          </DialogDescription>
        </DialogHeader>

        <ul
          className="grid list-none gap-3 max-lg:px-6 max-lg:pb-2 sm:grid-cols-2 sm:gap-4"
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
                      className="size-4 h-lh shrink-0 text-primary"
                    />
                    <strong className="font-heading font-semibold text-foreground">
                      {option.label}
                    </strong>
                  </span>
                  <span className="pl-6 text-base leading-snug text-muted-foreground sm:text-sm">
                    {option.description}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="max-lg:px-6 max-lg:pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:justify-stretch">
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
