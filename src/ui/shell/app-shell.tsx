import type { ReactNode } from "react";

import { HouseIcon } from "@/ui/icons/app-icons";
import { GlobalAddSheet } from "@/ui/shell/global-add-sheet.client";
import { PrimaryNav } from "@/ui/shell/primary-nav.client";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="app-shell__brand">
        <span className="app-shell__brand-mark" aria-hidden="true">
          <HouseIcon />
        </span>
        <span>Our Home</span>
      </header>

      <main id="main-content" className="app-shell__main" tabIndex={-1}>
        {children}
      </main>

      <PrimaryNav />

      <GlobalAddSheet />
    </div>
  );
}
