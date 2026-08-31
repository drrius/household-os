import { describe, expect, it } from "vitest";

import { approvalRows, type MemberNamer } from "./assistant-approval-summary";

const NAMES: Record<string, string> = { darius: "Darius", leah: "Leah" };
const nameOf: MemberNamer = (id) =>
  typeof id === "string" ? (NAMES[id] ?? null) : null;

describe("approvalRows", () => {
  it("summarises an equally split expense as term/detail pairs", () => {
    expect(
      approvalRows(
        {
          description: "Coop groceries",
          amountCents: 8430,
          payerMemberId: "darius",
          occurredOn: "2026-08-12",
          split: { kind: "equal" },
        },
        nameOf,
      ),
    ).toEqual([
      { label: "What", value: "Coop groceries" },
      { label: "Amount", value: "CHF 84.30" },
      { label: "Paid by", value: "Darius" },
      { label: "Split", value: "Equally" },
      { label: "Date", value: "12 Aug 2026" },
    ]);
  });

  it("names every member in a custom split", () => {
    const rows = approvalRows(
      {
        amountCents: 10_000,
        split: {
          kind: "custom",
          allocations: [
            { memberId: "darius", allocatedCents: 6000 },
            { memberId: "leah", allocatedCents: 4000 },
          ],
        },
      },
      nameOf,
    );

    expect(rows).toContainEqual({
      label: "Split",
      value: "Darius CHF 60.00 · Leah CHF 40.00",
    });
  });

  it("shows the reversal and the replacement of a correction", () => {
    const rows = approvalRows(
      {
        originalDescription: "Rent · August",
        originalAmountCents: 185_000,
        replacement: {
          description: "Rent · August",
          amountCents: 175_000,
          payerMemberId: "darius",
        },
      },
      nameOf,
    );

    expect(rows).toEqual([
      { label: "Reverses", value: "Rent · August (CHF 1850.00)" },
      { label: "What", value: "Rent · August", startsGroup: true },
      { label: "Amount", value: "CHF 1750.00" },
      { label: "Paid by", value: "Darius" },
    ]);
  });

  it("says so when a correction reverses without replacing", () => {
    expect(
      approvalRows(
        {
          originalDescription: "Duplicate rent",
          originalAmountCents: 185_000,
          replacement: null,
        },
        nameOf,
      ),
    ).toEqual([
      { label: "Reverses", value: "Duplicate rent (CHF 1850.00)" },
      { label: "Replaced by", value: "Nothing" },
    ]);
  });

  it("drops amounts that are not safe integer centimes", () => {
    expect(approvalRows({ amountCents: 84.3 }, nameOf)).toEqual([]);
  });

  it("skips member ids it cannot name", () => {
    expect(approvalRows({ payerMemberId: "stranger" }, nameOf)).toEqual([]);
  });
});
