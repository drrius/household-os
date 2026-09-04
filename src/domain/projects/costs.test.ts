import { expect, it } from "vitest";
import fc from "fast-check";
import { formatProjectCost, projectPaidCosts, type CostEvent } from "./costs";

const link = {
  financial_event_id: "expense",
  contextId: "trip",
  archived: false,
};
const expense: CostEvent = {
  id: "expense",
  type: "expense",
  amount_cents: 10000,
  related_event_id: null,
};

it("attributes replacements, refunds and reversed refunds through the original cost", () => {
  const history: CostEvent[] = [
    expense,
    {
      id: "reverse",
      type: "reversal",
      amount_cents: 10000,
      related_event_id: "expense",
    },
    {
      id: "replacement",
      type: "replacement",
      amount_cents: 15000,
      related_event_id: "expense",
    },
    {
      id: "refund",
      type: "refund",
      amount_cents: 2000,
      related_event_id: "replacement",
    },
  ];
  expect(projectPaidCosts("trip", history, [link]).paidCents).toBe(13000n);
  expect(
    projectPaidCosts(
      "trip",
      [
        ...history,
        {
          id: "undo-refund",
          type: "reversal",
          amount_cents: 2000,
          related_event_id: "refund",
        },
      ],
      [link],
    ).paidCents,
  ).toBe(15000n);
});

it("honors an explicit replacement context without double counting", () => {
  const history: CostEvent[] = [
    expense,
    {
      id: "reverse",
      type: "reversal",
      amount_cents: 10000,
      related_event_id: "expense",
    },
    {
      id: "replacement",
      type: "replacement",
      amount_cents: 15000,
      related_event_id: "expense",
    },
  ];
  const links = [
    link,
    { financial_event_id: "replacement", contextId: "other", archived: false },
  ];
  expect(projectPaidCosts("trip", history, links).paidCents).toBe(0n);
  expect(projectPaidCosts("other", history, links).paidCents).toBe(15000n);
});

it("does not treat settlement or opening balances as spending", () => {
  for (const type of ["settlement", "opening_balance"] as const)
    expect(
      projectPaidCosts("trip", [{ ...expense, type }], [link]).paidCents,
    ).toBe(0n);
});

it("reversing any valid expense brings its context cost back to zero", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
      (amount) => {
        const history: CostEvent[] = [
          { ...expense, amount_cents: amount },
          {
            id: "reverse",
            type: "reversal",
            amount_cents: amount,
            related_event_id: "expense",
          },
        ];
        expect(projectPaidCosts("trip", history, [link]).paidCents).toBe(0n);
      },
    ),
  );
});

it("keeps large household totals exact", () => {
  const amount = Number.MAX_SAFE_INTEGER;
  const total = projectPaidCosts(
    "trip",
    [
      { ...expense, amount_cents: amount },
      { ...expense, id: "second", amount_cents: amount },
    ],
    [link, { ...link, financial_event_id: "second" }],
  ).paidCents;
  expect(total).toBe(BigInt(amount) * 2n);
  expect(formatProjectCost(101n)).toBe("CHF 1.01");
  expect(formatProjectCost(-101n)).toBe("−CHF 1.01");
});
