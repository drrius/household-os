import type { ReactNode } from "react";

export type AppPageProps = {
  children: ReactNode;
  labelledBy: string;
};

export function AppPage({ children, labelledBy }: AppPageProps) {
  return (
    <div className="flex flex-col gap-4" aria-labelledby={labelledBy}>
      {children}
    </div>
  );
}
