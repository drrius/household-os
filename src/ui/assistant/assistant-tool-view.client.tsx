"use client";

import {
  getToolOrDynamicToolName,
  type DynamicToolUIPart,
  type ToolUIPart,
} from "ai";
import { CheckIcon, MinusIcon, ShieldCheckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  approvalRows,
  type MemberNamer,
} from "@/ui/assistant/assistant-approval-summary";
import { useAssistant } from "@/ui/assistant/assistant-context";
import {
  activityLabel,
  activityTone,
  approvalTitle,
  isFinancialTool,
  type ActivityTone,
} from "@/ui/assistant/assistant-tool-labels";

export type AnyToolPart = ToolUIPart | DynamicToolUIPart;

export type ApprovalResponder = (options: {
  id: string;
  approved: boolean;
}) => void;

function ApprovalCard({
  part,
  respond,
}: {
  part: AnyToolPart & { state: "approval-requested" };
  respond: ApprovalResponder;
}) {
  const { members } = useAssistant();
  const nameOf: MemberNamer = (id) =>
    typeof id === "string"
      ? (members.find((member) => member.memberId === id)?.name ?? null)
      : null;
  const name = getToolOrDynamicToolName(part);
  const rows = approvalRows(part.input, nameOf);
  const input = part.input as { mode?: unknown } | null;
  const notes = [
    input?.mode === "full"
      ? "This posts exactly the amount above and settles the balance."
      : null,
    isFinancialTool(name)
      ? "Money history is append-only, so approving records this for good."
      : null,
  ].filter((note) => note !== null);

  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-primary/30">
      <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <ShieldCheckIcon aria-hidden="true" className="size-4 h-lh shrink-0" />
        Needs your OK
      </p>
      <p className="mt-1 font-heading text-base font-semibold text-foreground">
        {approvalTitle(name)}
      </p>

      {rows.length > 0 && (
        <dl className="mt-3 grid gap-1.5 text-base sm:text-sm">
          {rows.map((row) => (
            <div
              className={cn(
                "flex items-baseline justify-between gap-4",
                row.startsGroup === true &&
                  "mt-1.5 border-t border-border pt-3",
              )}
              key={`${row.label}-${row.value}`}
            >
              <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 text-right font-medium tabular-nums">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {notes.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground text-pretty">
          {notes.join(" ")}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          className="flex-1"
          onClick={() => respond({ id: part.approval.id, approved: true })}
          type="button"
        >
          Approve
        </Button>
        <Button
          className="flex-1"
          onClick={() => respond({ id: part.approval.id, approved: false })}
          type="button"
          variant="outline"
        >
          Not now
        </Button>
      </div>
    </div>
  );
}

function ActivityIcon({ tone }: { tone: ActivityTone }) {
  const className = "size-4 h-lh shrink-0";
  switch (tone) {
    case "done": {
      return <CheckIcon aria-hidden="true" className={className} />;
    }
    case "skipped": {
      return <MinusIcon aria-hidden="true" className={className} />;
    }
    case "failed": {
      return (
        <XIcon
          aria-hidden="true"
          className={cn(className, "text-destructive")}
        />
      );
    }
    default: {
      return <Spinner className={className} />;
    }
  }
}

/**
 * Tool calls are progress, not content: a quiet labelled line each, with no
 * card, no badge, and no raw payload. Only failures raise their voice.
 */
export function ToolActivity({ parts }: { parts: readonly AnyToolPart[] }) {
  return (
    <ul
      className="grid gap-1.5 text-base text-muted-foreground sm:text-sm"
      role="list"
    >
      {parts.map((part, index) => {
        const tone = activityTone(part);
        const name = getToolOrDynamicToolName(part);
        return (
          <li
            className={cn(
              "flex items-start gap-2",
              tone === "failed" && "text-foreground",
            )}
            key={`${name}-${index}`}
          >
            <ActivityIcon tone={tone} />
            <span className="min-w-0 flex-1">
              {activityLabel(name, tone)}
              {part.state === "output-error" && (
                <span className="block text-muted-foreground">
                  {part.errorText}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ApprovalPart({
  part,
  respond,
}: {
  part: AnyToolPart;
  respond: ApprovalResponder;
}) {
  if (!needsApproval(part)) {
    return null;
  }
  return <ApprovalCard part={part} respond={respond} />;
}

/** True when the part needs a decision card rather than an activity line. */
export function needsApproval(
  part: AnyToolPart,
): part is AnyToolPart & { state: "approval-requested" } {
  return (
    part.state === "approval-requested" && part.approval.isAutomatic !== true
  );
}
