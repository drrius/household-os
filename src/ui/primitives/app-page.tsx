import type { ReactNode } from "react";

export type AppPageProps = {
  children: ReactNode;
  labelledBy: string;
};

export function AppPage({ children, labelledBy }: AppPageProps) {
  return (
    <div className="u-stack" aria-labelledby={labelledBy}>
      {children}
    </div>
  );
}
