"use client";

import {
  getToolOrDynamicToolName,
  type DynamicToolUIPart,
  type ToolUIPart,
} from "ai";

import {
  Tool,
  ToolPayload,
  type ToolDisplayState,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";

export type AnyToolPart = ToolUIPart | DynamicToolUIPart;

export type ApprovalResponder = (options: {
  id: string;
  approved: boolean;
}) => void;

const TOOL_LABELS: Record<string, string> = {
  get_today_overview: "Checking today",
  get_routines: "Looking up routines",
  get_week_plan: "Looking at the meal plan",
  get_grocery_list: "Reading the grocery list",
  get_money_overview: "Checking the money picture",
  get_household: "Looking up the household",
  create_routine: "Creating a routine",
  update_routine: "Updating a routine",
  pause_routine: "Pausing a routine",
  unpause_routine: "Resuming a routine",
  archive_routine: "Archiving a routine",
  complete_occurrence: "Completing a task",
  skip_occurrence: "Skipping a task",
  reschedule_occurrence: "Rescheduling a task",
  add_grocery_item: "Adding a grocery item",
  remove_grocery_item: "Removing a grocery item",
  start_shopping_session: "Starting shopping",
  claim_grocery_item: "Claiming a grocery item",
  release_grocery_item: "Releasing a grocery item",
  finish_shopping_session: "Finishing shopping",
  plan_meal: "Planning a meal",
  move_meal_entry: "Moving a meal",
  update_meal_entry: "Updating a meal",
  remove_meal_entry: "Removing a meal",
  create_meal_preparation: "Adding a preparation task",
  create_area: "Creating an area",
  create_pet: "Adding a pet",
  update_household_name: "Renaming the household",
  dismiss_expense_draft: "Dismissing an expense draft",
  create_recurring_expense_rule: "Creating a recurring expense",
  set_recurring_expense_rule_active: "Toggling a recurring expense",
  record_expense: "Record an expense",
  record_refund: "Record a refund",
  record_settlement: "Record a settlement",
  establish_opening_balance: "Establish the opening balance",
  confirm_expense_draft: "Confirm an expense draft",
  correct_financial_event: "Correct a money event",
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replaceAll("_", " ");
}

function formatChf(cents: unknown): string | null {
  if (typeof cents !== "number" || !Number.isSafeInteger(cents)) {
    return null;
  }
  return `CHF ${(cents / 100).toFixed(2)}`;
}

function approvalSummary(input: unknown): readonly string[] {
  if (input === null || typeof input !== "object") {
    return [];
  }
  const value = input as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof value.description === "string") {
    lines.push(value.description);
  }
  const amount = formatChf(value.amountCents);
  if (amount !== null) {
    lines.push(amount);
  }
  if (typeof value.occurredOn === "string") {
    lines.push(`on ${value.occurredOn}`);
  }
  if (value.mode === "full") {
    lines.push("settles the full balance");
  }
  return lines;
}

function ApprovalCard({
  part,
  respond,
}: {
  part: AnyToolPart & { state: "approval-requested" };
  respond: ApprovalResponder;
}) {
  const lines = approvalSummary(part.input);
  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-4 shadow-sm">
      <p className="font-heading font-semibold text-foreground">
        {toolLabel(getToolOrDynamicToolName(part))}?
      </p>
      {lines.length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">{lines.join(" · ")}</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Money history is append-only, so this is recorded permanently once
        approved.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          onClick={() => respond({ id: part.approval.id, approved: true })}
          size="sm"
          type="button"
        >
          Approve
        </Button>
        <Button
          onClick={() => respond({ id: part.approval.id, approved: false })}
          size="sm"
          type="button"
          variant="outline"
        >
          Not now
        </Button>
      </div>
    </div>
  );
}

export function ToolPart({
  part,
  respond,
}: {
  part: AnyToolPart;
  respond: ApprovalResponder;
}) {
  if (
    part.state === "approval-requested" &&
    part.approval.isAutomatic !== true
  ) {
    return <ApprovalCard part={part} respond={respond} />;
  }
  return (
    <Tool
      label={toolLabel(getToolOrDynamicToolName(part))}
      state={part.state as ToolDisplayState}
    >
      {part.input !== undefined && (
        <div className="grid gap-2">
          <ToolPayload value={part.input} />
          {part.state === "output-available" && (
            <ToolPayload value={part.output} />
          )}
          {part.state === "output-error" && (
            <p className="text-xs text-destructive">{part.errorText}</p>
          )}
        </div>
      )}
    </Tool>
  );
}
