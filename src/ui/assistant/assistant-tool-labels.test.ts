import { describe, expect, it } from "vitest";

import {
  activityLabel,
  activityTone,
  approvalTitle,
  isFinancialTool,
} from "./assistant-tool-labels";

describe("activityTone", () => {
  it("settles the terminal states", () => {
    expect(activityTone({ state: "output-available" })).toBe("done");
    expect(activityTone({ state: "output-denied" })).toBe("skipped");
    expect(activityTone({ state: "output-error" })).toBe("failed");
  });

  it("keeps a call running while it is still in flight", () => {
    expect(activityTone({ state: "input-streaming" })).toBe("running");
    expect(activityTone({ state: "input-available" })).toBe("running");
    expect(activityTone({ state: "approval-requested" })).toBe("running");
  });

  it("settles a declined approval without waiting for the round trip", () => {
    expect(
      activityTone({
        state: "approval-responded",
        approval: { approved: false },
      }),
    ).toBe("skipped");
  });

  it("keeps an approved call running until its output lands", () => {
    expect(
      activityTone({
        state: "approval-responded",
        approval: { approved: true },
      }),
    ).toBe("running");
  });
});

describe("activityLabel", () => {
  it("carries tense so a finished call never reads as in progress", () => {
    expect(activityLabel("get_today_overview", "running")).toBe(
      "Checking today",
    );
    expect(activityLabel("get_today_overview", "done")).toBe("Checked today");
  });

  it("never claims a call that did not happen did", () => {
    expect(activityLabel("add_grocery_item", "failed")).toBe(
      "Adding a grocery item — didn't work",
    );
    expect(activityLabel("add_grocery_item", "skipped")).toBe(
      "Adding a grocery item — not now",
    );
  });

  it("falls back to a readable name for an unmapped tool", () => {
    expect(activityLabel("some_new_tool", "done")).toBe("some new tool");
  });
});

describe("approvalTitle", () => {
  it("asks about the pending action", () => {
    expect(approvalTitle("record_expense")).toBe("Record this expense?");
  });

  it("falls back to a question built from the tool label", () => {
    expect(approvalTitle("create_routine")).toBe("Creating a routine?");
  });
});

describe("isFinancialTool", () => {
  it("marks the tools that write to the append-only ledger", () => {
    expect(isFinancialTool("record_expense")).toBe(true);
    expect(isFinancialTool("correct_financial_event")).toBe(true);
    expect(isFinancialTool("create_routine")).toBe(false);
  });
});
