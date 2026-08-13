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
    // The trailing slot commonly holds a non-shrinking pill, so on narrow
    // viewports it takes its own row instead of squeezing the title column.
    <header className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
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
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {trailing}
        </div>
      ) : null}
    </header>
  );
}
