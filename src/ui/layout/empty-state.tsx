import type { ReactNode } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export type EmptyStateProps = {
  action?: ReactNode;
  children?: ReactNode;
  title: ReactNode;
};

export function EmptyState({ action, children, title }: EmptyStateProps) {
  return (
    <Empty className="min-h-48 border p-8">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {children !== undefined && children !== null ? (
          <EmptyDescription>{children}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action !== undefined && action !== null ? (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {action}
          </div>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
