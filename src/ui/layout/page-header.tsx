import type { ReactNode } from "react";

export type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleId?: string;
  trailing?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  titleId,
  trailing,
}: PageHeaderProps) {
  return (
    <header className="flex flex-row items-center justify-between gap-4 sm:items-end sm:gap-4">
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
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {trailing}
        </div>
      ) : null}
    </header>
  );
}
