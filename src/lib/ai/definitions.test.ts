import { z } from "zod";
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
      "record_contextual_expense",
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

describe("biweekly schedules", () => {
  it("maps onto the routine engine's calendar rule", () => {
    expect(toRoutineSchedule({ kind: "biweekly", weekday: 4 })).toEqual({
      scheduleKind: "calendar",
      scheduleRule: { kind: "biweekly", weekday: 4 },
    });
  });
});

describe("assignment pairing", () => {
  const MEMBER = "11111111-1111-4111-8111-111111111111";
  const AREA = "22222222-2222-4222-8222-222222222222";
  const base = {
    title: "Water the plants",
    areaId: AREA,
    schedule: { kind: "daily" },
  };

  function parseCreateRoutine(extra: Record<string, unknown>) {
    return getAiToolDefinition("create_routine")?.inputSchema.safeParse({
      ...base,
      ...extra,
    });
  }

  it("requires the member id its policy depends on", () => {
    expect(parseCreateRoutine({ assignmentPolicy: "assigned" })?.success).toBe(
      false,
    );
    expect(
      parseCreateRoutine({ assignmentPolicy: "alternating" })?.success,
    ).toBe(false);
    expect(
      parseCreateRoutine({
        assignmentPolicy: "shared",
        assignedMemberId: MEMBER,
      })?.success,
    ).toBe(false);
    expect(
      parseCreateRoutine({
        assignmentPolicy: "assigned",
        assignedMemberId: MEMBER,
      })?.success,
    ).toBe(true);
    expect(parseCreateRoutine({ assignmentPolicy: "shared" })?.success).toBe(
      true,
    );
  });
});

describe("shopping draft contract", () => {
  it("requires the shared amount and payer when a draft is requested", () => {
    const result = getAiToolDefinition(
      "finish_shopping_session",
    )?.inputSchema.safeParse({
      shoppingSessionId: "55555555-5555-4555-8555-555555555555",
      createExpenseDraft: true,
    });
    expect(result?.success).toBe(false);
  });
});

it("publishes JSON input schemas for every assistant tool", () => {
  for (const definition of AI_TOOL_DEFINITIONS) {
    expect(
      () =>
        JSON.stringify(z.toJSONSchema(definition.inputSchema, { io: "input" })),
      definition.name,
    ).not.toThrow();
  }
});
