import type { ReactNode } from "react";

export type PageSectionProps = {
  action?: ReactNode;
  children: ReactNode;
  title: ReactNode;
  titleId?: string;
};

export function PageSection({
  action,
  children,
  title,
  titleId,
}: PageSectionProps) {
  return (
    <section className="grid gap-3" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-3">
        <h2
          className="font-heading text-xl leading-tight font-semibold"
          id={titleId}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
