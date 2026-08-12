import type { ReactNode } from "react";

import { HouseIcon } from "@/ui/icons/app-icons";
import { GlobalAddSheet } from "@/ui/shell/global-add-sheet.client";
import { PrimaryNav } from "@/ui/shell/primary-nav.client";

export type AppShellProps = {
  children: ReactNode;
  unreadCount?: number;
};

export function AppShell({ children, unreadCount }: AppShellProps) {
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
        {unreadCount !== undefined && unreadCount > 0 ? (
          <span className="u-visually-hidden">
            {unreadCount} unread{" "}
            {unreadCount === 1 ? "notification" : "notifications"}
          </span>
        ) : null}
      </header>

      <PrimaryNav />

      <main id="main-content" className="app-shell__main" tabIndex={-1}>
        {children}
      </main>

      <GlobalAddSheet />
    </div>
  );
}
