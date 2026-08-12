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
    <header className="page-header">
      <div>
        {eyebrow !== undefined && eyebrow !== null ? <p>{eyebrow}</p> : null}
        <h1 id={titleId}>{title}</h1>
      </div>
      {trailing !== undefined && trailing !== null ? (
        <div className="u-cluster">{trailing}</div>
      ) : null}
    </header>
  );
}
