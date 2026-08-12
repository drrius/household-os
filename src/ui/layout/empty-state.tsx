import type { ReactNode } from "react";

export type EmptyStateProps = {
  action?: ReactNode;
  children?: ReactNode;
  title: ReactNode;
};

export function EmptyState({ action, children, title }: EmptyStateProps) {
  return (
    <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          {title}
        </h2>
        {children}
        {action !== undefined && action !== null ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}
