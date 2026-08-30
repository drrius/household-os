"use client";

import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleSlashIcon,
  Loader2Icon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import * as React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ToolDisplayState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

const STATE_LABELS: Record<ToolDisplayState, string> = {
  "input-streaming": "Preparing",
  "input-available": "Running",
  "approval-requested": "Waiting for approval",
  "approval-responded": "Answered",
  "output-available": "Done",
  "output-error": "Failed",
  "output-denied": "Not approved",
};

function StateIcon({ state }: { state: ToolDisplayState }) {
  switch (state) {
    case "output-available":
      return <CheckCircle2Icon className="size-3.5 text-success" />;
    case "output-error":
      return <XCircleIcon className="size-3.5 text-destructive" />;
    case "output-denied":
      return <CircleSlashIcon className="size-3.5 text-muted-foreground" />;
    case "input-streaming":
    case "input-available":
      return (
        <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
      );
    default:
      return <WrenchIcon className="size-3.5 text-muted-foreground" />;
  }
}

type ToolProps = {
  label: string;
  state: ToolDisplayState;
  children?: React.ReactNode;
  className?: string;
};

/** Compact, expandable record of one tool invocation inside a message. */
export function Tool({ label, state, children, className }: ToolProps) {
  return (
    <Collapsible
      className={cn(
        "rounded-xl border border-border bg-card/60 text-sm",
        className,
      )}
    >
      <CollapsibleTrigger className="group flex min-h-9 w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <StateIcon state={state} />
        <span className="min-w-0 flex-1 truncate font-heading font-semibold text-foreground">
          {label}
        </span>
        <span className="shrink-0 text-xs">{STATE_LABELS[state]}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden px-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ToolPayload({ value }: { value: unknown }) {
  return (
    <pre className="max-h-48 overflow-auto rounded-lg bg-secondary/60 p-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
