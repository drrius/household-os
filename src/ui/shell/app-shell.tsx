import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { GlobalAddSheet } from "@/ui/shell/global-add-sheet.client";
import { PrimaryNav } from "@/ui/shell/primary-nav.client";

type AppShellProps = {
  children: ReactNode;
  householdName?: string;
};

export function AppShell({
  children,
  householdName = "Our Home",
}: AppShellProps) {
  return (
    <>
      <a
        className="fixed top-2 left-2 z-40 -translate-y-[calc(100%+0.5rem)] rounded-lg bg-foreground px-3 py-2 font-heading font-bold text-background no-underline focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>

      <div className="isolate grid min-h-dvh grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto]">
        <header className="hidden min-h-11 items-center gap-2 border-r bg-sidebar p-6 font-heading text-xl font-bold lg:col-start-1 lg:row-start-1 lg:flex">
          <Link
            className="inline-flex min-w-0 items-center gap-2 no-underline"
            href="/"
          >
            <span className="inline-flex w-18 shrink-0" aria-hidden="true">
              <Image
                alt=""
                className="h-auto w-full"
                height={46}
                priority
                src="/brand/birds-building-nest.png"
                width={80}
              />
            </span>
            <span className="line-clamp-2 min-w-0 text-sm leading-tight">
              {householdName}
            </span>
          </Link>
        </header>

        <main
          id="main-content"
          // 5.75rem add-button offset + 3rem button + 1rem gap, with the same
          // 0.75rem safe-area floor the floating chrome uses.
          className="row-start-1 mx-auto min-w-0 w-full max-w-6xl px-4 pt-6 max-lg:pb-[calc(9.75rem+max(0.75rem,env(safe-area-inset-bottom)))] lg:col-start-2 lg:row-[1/-1] lg:max-w-none lg:p-8 lg:pb-8"
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
