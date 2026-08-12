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
    <section className="page-section" aria-labelledby={titleId}>
      <div className="u-split">
        <h2 className="page-section__title" id={titleId}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
