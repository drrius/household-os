import type { ReactNode } from "react";

type StatusPillTone = "default" | "success" | "warning" | "accent";

export type StatusPillProps = {
  children: ReactNode;
  tone?: StatusPillTone;
};

function getToneClassName(tone: StatusPillTone): string | undefined {
  switch (tone) {
    case "default":
      return undefined;
    case "success":
      return "pill--success";
    case "warning":
      return "pill--warning";
    case "accent":
      return "pill--accent";
    default: {
      const exhaustiveTone: never = tone;
      return exhaustiveTone;
    }
  }
}

export function StatusPill({ children, tone = "default" }: StatusPillProps) {
  const classes = ["pill", getToneClassName(tone)].filter(Boolean).join(" ");

  return <span className={classes}>{children}</span>;
}
