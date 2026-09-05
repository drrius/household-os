import { Suspense, type ReactNode } from "react";
import { SearchReturn } from "@/ui/search/search-return.client";
import Link from "next/link";
import { Search } from "lucide-react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AssistantProvider,
  type AssistantMember,
} from "@/ui/assistant/assistant-context";
import { AssistantPanelLazy } from "@/ui/assistant/assistant-panel-lazy.client";
import { AssistantTrigger } from "@/ui/assistant/assistant-trigger.client";
import { AppSidebar } from "@/ui/shell/app-sidebar.client";
import { GlobalAddSheet } from "@/ui/shell/global-add-sheet.client";
import { PrimaryNav } from "@/ui/shell/primary-nav.client";

type AppShellProps = {
  children: ReactNode;
  householdName?: string;
  /** Names the assistant's approval cards use to label payers and splits. */
  members?: readonly AssistantMember[];
};

export function AppShell({
  children,
  householdName = "Our Home",
  members = [],
}: AppShellProps) {
  return (
    <>
      <a
        className="fixed top-2 left-2 z-40 -translate-y-[calc(100%+0.5rem)] rounded-lg bg-foreground px-3 py-2 font-heading font-bold text-background no-underline focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>

      <TooltipProvider>
        <SidebarProvider className="isolate">
          <AssistantProvider members={members}>
            <AppSidebar householdName={householdName} />

            <main
              id="main-content"
              // 5.75rem add-button offset + 3rem button + 1rem gap, with the same
              // 0.75rem safe-area floor the floating chrome uses. The assistant
              // trigger stacks one slot above the add button inside that space.
              className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pt-6 max-lg:pb-[calc(13.25rem+max(0.75rem,env(safe-area-inset-bottom)))] lg:max-w-none lg:p-8"
              tabIndex={-1}
            >
              <div className="mb-3 flex justify-end lg:hidden">
                <Link
                  href="/search"
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium no-underline hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Search className="size-4" aria-hidden="true" />
                  Search household
                </Link>
              </div>
              <Suspense fallback={null}>
                <SearchReturn />
              </Suspense>
              {children}
            </main>

            {/* Anchor mobile controls to the top plus the dynamic viewport
                height. iOS can retain a stale bottom-fixed position after the
                keyboard closes or browser chrome changes during scrolling. */}
            <div className="pointer-events-none fixed inset-x-0 top-0 z-20 h-dvh lg:hidden">
              <PrimaryNav />
              <GlobalAddSheet />
              <AssistantTrigger placement="mobile" />
            </div>
            <AssistantPanelLazy />
          </AssistantProvider>
        </SidebarProvider>
      </TooltipProvider>
    </>
  );
}
