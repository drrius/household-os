"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { GLOBAL_ADD_OPTIONS } from "@/lib/ui/destinations";
import { PlusIcon } from "@/ui/icons/app-icons";

export function GlobalAddSheet() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            aria-label="Add something"
            className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-20 size-14 rounded-full shadow-[0_6px_20px_rgba(226,80,60,0.3)] lg:static lg:col-start-1 lg:row-start-3 lg:m-4 lg:h-11 lg:w-auto lg:px-4"
            size="icon-lg"
          />
        }
      >
        <PlusIcon />
        <span className="hidden lg:inline">Add something</span>
      </SheetTrigger>

      <SheetContent
        className="mx-auto max-h-[min(90dvh,48rem)] w-full max-w-xl overflow-y-auto rounded-t-3xl"
        side="bottom"
      >
        <SheetHeader className="pb-4">
          <SheetTitle>Add something</SheetTitle>
          <SheetDescription>
            It lands in the right place for both of you.
          </SheetDescription>
        </SheetHeader>

        <ul className="flex list-none flex-col gap-3 px-6 pb-4">
          {GLOBAL_ADD_OPTIONS.map((option) => (
            <li key={option.id}>
              <SheetClose
                render={
                  <Link
                    className="block rounded-2xl border bg-card p-4 shadow-sm no-underline transition-colors hover:bg-muted motion-reduce:transition-none"
                    href={option.href}
                  />
                }
              >
                <strong className="block font-extrabold">{option.label}</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {option.description}
                </p>
              </SheetClose>
            </li>
          ))}
        </ul>

        <SheetFooter className="pt-0">
          <SheetClose
            render={
              <Button className="w-full" variant="outline" type="button" />
            }
          >
            Cancel
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
