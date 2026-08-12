import type { ReactNode } from "react";

import { HouseIcon } from "@/ui/icons/app-icons";
import { GlobalAddSheet } from "@/ui/shell/global-add-sheet.client";
import { PrimaryNav } from "@/ui/shell/primary-nav.client";

export type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="u-visually-hidden" href="#main-content">
        Skip to content
      </a>

      <div className="app-shell__brand">
        <span className="app-shell__brand-mark" aria-hidden="true">
          <HouseIcon />
        </span>
        <span>Our Home</span>
      </div>

      <PrimaryNav />

      <main id="main-content" className="app-shell__main">
        {children}
      </main>

      <GlobalAddSheet />
    </div>
  );
}
