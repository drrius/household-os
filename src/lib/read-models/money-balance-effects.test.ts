import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { mapMoneyViewModel, type MoneyReadInput } from "./money";

const viewerId = "00000000-0000-0000-0000-000000000001";
const partnerId = "00000000-0000-0000-0000-000000000002";

/** Reads a rendered franc string back to centimes, integer arithmetic only. */
function parseSignedFrancs(display: string): number {
  const groups = /^(?<sign>[+-]?)CHF (?<francs>\d+)\.(?<centimes>\d{2})$/.exec(
    display,
  )?.groups;
  if (groups === undefined) {
    throw new Error(`Unparseable franc display: ${display}`);
  }
  const magnitude = Number(groups.francs) * 100 + Number(groups.centimes);
  return groups.sign === "-" ? -magnitude : magnitude;
}

function moneyInput(overrides: Partial<MoneyReadInput> = {}): MoneyReadInput {
  return {
    viewerId,
    members: [
      { user_id: viewerId, display_name: "Sam" },
      { user_id: partnerId, display_name: "Leah" },
    ],
    ledgerEntries: [],
    events: [],
    allocations: [],
    drafts: [],
    ...overrides,
  };
}

describe("mapMoneyViewModel balance effects", () => {
  it("states the balance effect of settlements and reversals", () => {
    const model = mapMoneyViewModel(
      moneyInput({
        ledgerEntries: [
          {
            financial_event_id: "viewer-expense",
            member_id: viewerId,
            receivable_delta_cents: 500,
          },
          {
            financial_event_id: "viewer-expense",
            member_id: partnerId,
            receivable_delta_cents: -500,
          },
          {
            financial_event_id: "partner-expense",
            member_id: partnerId,
            receivable_delta_cents: 2_000,
          },
          {
            financial_event_id: "partner-expense",
            member_id: viewerId,
            receivable_delta_cents: -2_000,
          },
          {
            financial_event_id: "settlement",
            member_id: partnerId,
            receivable_delta_cents: 5_000,
          },
          {
            financial_event_id: "settlement",
            member_id: viewerId,
            receivable_delta_cents: -5_000,
          },
          {
            financial_event_id: "reversal",
            member_id: partnerId,
            receivable_delta_cents: -2_000,
          },
          {
            financial_event_id: "reversal",
            member_id: viewerId,
            receivable_delta_cents: 2_000,
          },
        ],
        events: [
          {
            id: "viewer-expense",
            type: "expense",
            occurred_on: "2026-08-11",
            created_at: "2026-08-11T10:00:00Z",
            created_by_member_id: viewerId,
            payer_member_id: viewerId,
            description: "Groceries",
            amount_cents: 1_000,
            related_event_id: null,
          },
          {
            id: "partner-expense",
            type: "expense",
            occurred_on: "2026-08-12",
            created_at: "2026-08-12T10:00:00Z",
            created_by_member_id: partnerId,
            payer_member_id: partnerId,
            description: "Dinner out",
            amount_cents: 4_000,
            related_event_id: null,
          },
          {
            id: "settlement",
            type: "settlement",
            occurred_on: "2026-08-13",
            created_at: "2026-08-13T10:00:00Z",
            created_by_member_id: partnerId,
            payer_member_id: partnerId,
            description: "Twint transfer",
            amount_cents: 5_000,
            related_event_id: null,
          },
          {
            id: "reversal",
            type: "reversal",
            occurred_on: "2026-08-14",
            created_at: "2026-08-14T10:00:00Z",
            created_by_member_id: viewerId,
            payer_member_id: null,
            description: "Correction: Dinner out",
            amount_cents: 4_000,
            related_event_id: "partner-expense",
          },
        ],
        allocations: [
          {
            financial_event_id: "viewer-expense",
            member_id: viewerId,
            allocated_cents: 500,
          },
          {
            financial_event_id: "viewer-expense",
            member_id: partnerId,
            allocated_cents: 500,
          },
          {
            financial_event_id: "partner-expense",
            member_id: viewerId,
            allocated_cents: 2_000,
          },
          {
            financial_event_id: "partner-expense",
            member_id: partnerId,
            allocated_cents: 2_000,
          },
        ],
      }),
    );

    expect(model.hero).toEqual({
      kind: "you_owe_partner",
      partnerName: "Leah",
      amount: "CHF 45.00",
    });
    expect(model.events).toEqual([
      {
        id: "reversal",
        title: "Correction: Dinner out",
        meta: "Sam recorded · 14 Aug 2026",
        amount: "CHF 40.00",
        balanceDelta: "+CHF 20.00",
        balanceEffect: "Balance with Leah moved in your favor by CHF 20.00",
        type: "Reversal",
      },
      {
        id: "settlement",
        title: "Twint transfer",
        meta: "Leah paid · 13 Aug 2026",
        amount: "CHF 50.00",
        balanceDelta: "-CHF 50.00",
        balanceEffect: "Balance with Leah moved against you by CHF 50.00",
        type: "Settlement",
      },
      {
        id: "partner-expense",
        title: "Dinner out",
        meta: "Leah paid · 12 Aug 2026",
        amount: "CHF 40.00",
        balanceDelta: "-CHF 20.00",
        balanceEffect: "Balance with Leah moved against you by CHF 20.00",
        type: "Expense",
      },
      {
        id: "viewer-expense",
        title: "Groceries",
        meta: "Sam paid · 11 Aug 2026",
        amount: "CHF 10.00",
        balanceDelta: "+CHF 5.00",
        balanceEffect: "Balance with Leah moved in your favor by CHF 5.00",
        type: "Expense",
      },
    ]);
  });

  it("keeps every rendered balance delta summing to the derived balance", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amountCents: fc.integer({ min: 1, max: 1_000_000 }),
            payerIsViewer: fc.boolean(),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (settlements) => {
          const input = moneyInput({
            events: settlements.map((settlement, index) => ({
              id: `settlement-${index}`,
              type: "settlement" as const,
              occurred_on: "2026-08-12",
              created_at: `2026-08-12T10:00:${String(index).padStart(2, "0")}Z`,
              created_by_member_id: viewerId,
              payer_member_id: settlement.payerIsViewer ? viewerId : partnerId,
              description: `Settlement ${index}`,
              amount_cents: settlement.amountCents,
              related_event_id: null,
            })),
            ledgerEntries: settlements.flatMap((settlement, index) => [
              {
                financial_event_id: `settlement-${index}`,
                member_id: settlement.payerIsViewer ? viewerId : partnerId,
                receivable_delta_cents: settlement.amountCents,
              },
              {
                financial_event_id: `settlement-${index}`,
                member_id: settlement.payerIsViewer ? partnerId : viewerId,
                receivable_delta_cents: -settlement.amountCents,
              },
            ]),
          });
          const model = mapMoneyViewModel(input);
          const summedDeltaCents = model.events.reduce(
            (total, event) => total + parseSignedFrancs(event.balanceDelta),
            0,
          );
          const balanceCents = settlements.reduce(
            (total, settlement) =>
              total +
              (settlement.payerIsViewer
                ? settlement.amountCents
                : -settlement.amountCents),
            0,
          );

          expect(summedDeltaCents).toBe(balanceCents);
          if (model.hero.kind !== "settled") {
            expect(parseSignedFrancs(model.hero.amount)).toBe(
              Math.abs(balanceCents),
            );
          } else {
            expect(balanceCents).toBe(0);
          }
        },
      ),
    );
  });
});
