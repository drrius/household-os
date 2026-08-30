import { describe, expect, it } from "vitest";

import {
  AI_TOOL_DEFINITIONS,
  FINANCIAL_TOOL_NAMES,
  getAiToolDefinition,
} from "./definitions";
import { toRoutineSchedule } from "./schedule";

describe("assistant tool definitions", () => {
  it("uses unique snake_case names", () => {
    const names = AI_TOOL_DEFINITIONS.map((definition) => definition.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("marks every financial-history command as financial", () => {
    expect(FINANCIAL_TOOL_NAMES).toEqual([
      "record_expense",
      "record_refund",
      "record_settlement",
      "establish_opening_balance",
      "confirm_expense_draft",
      "correct_financial_event",
    ]);
  });

  it("rejects non-integer and non-positive centime amounts", () => {
    const schema = getAiToolDefinition("record_expense")?.inputSchema;
    expect(schema).toBeDefined();
    const base = {
      description: "Groceries",
      payerMemberId: "11111111-1111-4111-8111-111111111111",
      split: { kind: "equal" },
    };
    expect(schema?.safeParse({ ...base, amountCents: 1250 }).success).toBe(
      true,
    );
    expect(schema?.safeParse({ ...base, amountCents: 12.5 }).success).toBe(
      false,
    );
    expect(schema?.safeParse({ ...base, amountCents: 0 }).success).toBe(false);
    expect(schema?.safeParse({ ...base, amountCents: -100 }).success).toBe(
      false,
    );
  });

  it("requires custom splits to name exactly two members", () => {
    const schema = getAiToolDefinition("record_expense")?.inputSchema;
    const result = schema?.safeParse({
      description: "Rent",
      amountCents: 200000,
      payerMemberId: "11111111-1111-4111-8111-111111111111",
      split: {
        kind: "custom",
        allocations: [
          {
            memberId: "11111111-1111-4111-8111-111111111111",
            allocatedCents: 200000,
          },
        ],
      },
    });
    expect(result?.success).toBe(false);
  });

  it("rejects malformed dates and ids", () => {
    const schema = getAiToolDefinition("reschedule_occurrence")?.inputSchema;
    expect(
      schema?.safeParse({
        occurrenceId: "11111111-1111-4111-8111-111111111111",
        newDueDate: "2026-09-01",
      }).success,
    ).toBe(true);
    expect(
      schema?.safeParse({
        occurrenceId: "not-a-uuid",
        newDueDate: "2026-09-01",
      }).success,
    ).toBe(false);
    expect(
      schema?.safeParse({
        occurrenceId: "11111111-1111-4111-8111-111111111111",
        newDueDate: "01.09.2026",
      }).success,
    ).toBe(false);
  });
});

describe("toRoutineSchedule", () => {
  it("maps calendar-style rules onto schedule_kind calendar", () => {
    expect(toRoutineSchedule({ kind: "daily" })).toEqual({
      scheduleKind: "calendar",
      scheduleRule: { kind: "daily" },
    });
    expect(toRoutineSchedule({ kind: "weekly", weekday: 3 })).toEqual({
      scheduleKind: "calendar",
      scheduleRule: { kind: "weekly", weekday: 3 },
    });
    expect(toRoutineSchedule({ kind: "weekdays", days: [1, 5] })).toEqual({
      scheduleKind: "calendar",
      scheduleRule: { kind: "weekdays", days: [1, 5] },
    });
    expect(toRoutineSchedule({ kind: "monthly", dayOfMonth: 31 })).toEqual({
      scheduleKind: "calendar",
      scheduleRule: { kind: "monthly", dayOfMonth: 31 },
    });
  });

  it("keeps one_off and after_completion as their own kinds", () => {
    expect(toRoutineSchedule({ kind: "one_off", date: "2026-09-01" })).toEqual({
      scheduleKind: "one_off",
      scheduleRule: { kind: "one_off", date: "2026-09-01" },
    });
    expect(
      toRoutineSchedule({ kind: "after_completion", every: 2, unit: "weeks" }),
    ).toEqual({
      scheduleKind: "after_completion",
      scheduleRule: { kind: "after_completion", every: 2, unit: "weeks" },
    });
  });
});
