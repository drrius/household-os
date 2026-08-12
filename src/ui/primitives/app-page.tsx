import type { ReactNode } from "react";

export type AppPageProps = {
  children: ReactNode;
  labelledBy: string;
};

export function AppPage({ children, labelledBy }: AppPageProps) {
  return (
    <main className="app-shell__main u-stack" aria-labelledby={labelledBy}>
      {children}
    </main>
  );
}
