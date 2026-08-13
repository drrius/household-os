import Link from "next/link";
import type { ReactNode } from "react";

import { HouseIcon } from "@/ui/icons/app-icons";
import { GlobalAddSheet } from "@/ui/shell/global-add-sheet.client";
import { PrimaryNav } from "@/ui/shell/primary-nav.client";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <>
      <a
        className="fixed top-2 left-2 z-40 -translate-y-[calc(100%+0.5rem)] rounded-lg bg-foreground px-3 py-2 font-heading font-bold text-background no-underline focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>

      <div className="grid min-h-dvh grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto]">
        <header className="hidden min-h-11 items-center gap-2 border-r bg-sidebar p-6 font-heading text-xl font-bold lg:col-start-1 lg:row-start-1 lg:flex">
          <Link
            className="inline-flex min-w-0 items-center gap-2 no-underline"
            href="/"
          >
            <span
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <HouseIcon />
            </span>
            <span>Our Home</span>
          </Link>
        </header>

        <main
          id="main-content"
          className="row-start-1 mx-auto min-w-0 w-full max-w-6xl px-4 pt-6 max-lg:pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] lg:col-start-2 lg:row-[1/-1] lg:max-w-none lg:p-8 lg:pb-8"
          tabIndex={-1}
        >
          {children}
        </main>

        <PrimaryNav />

        <GlobalAddSheet />
      </div>
    </>
  );
}
