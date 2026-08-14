import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  eyebrow?: ReactNode;
  mobileLayout?: "inline" | "stacked";
  title: ReactNode;
  titleId?: string;
  trailing?: ReactNode;
};

export function PageHeader({
  eyebrow,
  mobileLayout = "stacked",
  title,
  titleId,
  trailing,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
        mobileLayout === "inline"
          ? "flex-row items-center justify-between gap-4"
          : "flex-col items-start",
      )}
    >
      <div className="grid min-w-0 gap-1">
        {eyebrow !== undefined && eyebrow !== null ? (
          <p className="text-xs font-semibold text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="font-heading text-2xl leading-[1.1] font-black sm:text-3xl"
          id={titleId}
        >
          {title}
        </h1>
      </div>
      {trailing !== undefined && trailing !== null ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            mobileLayout === "inline" ? "shrink-0" : "max-sm:w-full",
          )}
        >
          {trailing}
        </div>
      ) : null}
    </header>
  );
}
