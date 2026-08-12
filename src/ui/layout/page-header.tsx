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
    <header className="flex items-end justify-between gap-4">
      <div className="grid gap-1">
        {eyebrow !== undefined && eyebrow !== null ? (
          <p className="font-heading text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="font-heading text-3xl leading-[1.1] font-semibold"
          id={titleId}
        >
          {title}
        </h1>
      </div>
      {trailing !== undefined && trailing !== null ? (
        <div className="flex flex-wrap items-center gap-2">{trailing}</div>
      ) : null}
    </header>
  );
}
