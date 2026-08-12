import type { ReactNode } from "react";

export type EmptyStateProps = {
  action?: ReactNode;
  children?: ReactNode;
  title: ReactNode;
};

export function EmptyState({ action, children, title }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="u-stack u-stack--sm">
        <h2>{title}</h2>
        {children}
        {action !== undefined && action !== null ? (
          <div className="u-cluster">{action}</div>
        ) : null}
      </div>
    </div>
  );
}
