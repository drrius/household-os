import type { ReactNode } from "react";

type CardTone = "default" | "warning" | "success" | "meal";

export type CardProps = {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  tone?: CardTone;
};

function getToneClassName(tone: CardTone): string | undefined {
  switch (tone) {
    case "default":
      return undefined;
    case "warning":
      return "card--warning";
    case "success":
      return "card--success";
    case "meal":
      return "card--meal";
    default: {
      const exhaustiveTone: never = tone;
      return exhaustiveTone;
    }
  }
}

export function Card({
  children,
  className,
  header,
  tone = "default",
}: CardProps) {
  const classes = ["card", getToneClassName(tone), className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      {header !== undefined && header !== null ? (
        <div className="card__header">{header}</div>
      ) : null}
      <div className="card__body">{children}</div>
    </div>
  );
}
