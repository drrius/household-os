import type { ReactNode } from "react";

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
              {children}
            </main>

            <PrimaryNav />
            <GlobalAddSheet />
            <AssistantTrigger placement="mobile" />
            <AssistantPanelLazy />
          </AssistantProvider>
        </SidebarProvider>
      </TooltipProvider>
    </>
  );
}
