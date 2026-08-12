import { describe, expect, it } from "vitest";

import {
  mapMoneyViewModel,
  parseMoneyReadRows,
  type MoneyReadInput,
} from "./money";

const viewerId = "00000000-0000-0000-0000-000000000001";
const partnerId = "00000000-0000-0000-0000-000000000002";

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

describe("mapMoneyViewModel", () => {
  it("labels a positive viewer balance as money the partner owes", () => {
    const model = mapMoneyViewModel(
      moneyInput({
        ledgerEntries: [
          {
            financial_event_id: "expense",
            member_id: viewerId,
            receivable_delta_cents: 500,
          },
          {
            financial_event_id: "expense",
            member_id: partnerId,
            receivable_delta_cents: -500,
          },
          {
            financial_event_id: "opening",
            member_id: viewerId,
            receivable_delta_cents: 300,
          },
          {
            financial_event_id: "opening",
            member_id: partnerId,
            receivable_delta_cents: -300,
          },
        ],
        events: [
          {
            id: "opening",
            type: "opening_balance",
            occurred_on: "2026-08-01",
            created_at: "2026-08-01T10:00:00Z",
            created_by_member_id: viewerId,
            payer_member_id: viewerId,
            description: "Starting balance",
            amount_cents: 300,
            related_event_id: null,
          },
          {
            id: "expense",
            type: "expense",
            occurred_on: "2026-08-10",
            created_at: "2026-08-10T10:00:00Z",
            created_by_member_id: viewerId,
            payer_member_id: viewerId,
            description: "Groceries",
            amount_cents: 1_000,
            related_event_id: null,
          },
        ],
        allocations: [
          {
            financial_event_id: "expense",
            member_id: viewerId,
            allocated_cents: 500,
          },
          {
            financial_event_id: "expense",
            member_id: partnerId,
            allocated_cents: 500,
          },
        ],
        drafts: [
          {
            id: "draft",
            source_kind: "shopping",
            description: "Market shop",
            amount_cents: 2_600,
            occurred_on: "2026-08-11",
            payer_member_id: viewerId,
            proposed_allocations: [{}, {}],
          },
        ],
      }),
    );

    expect(model.hero).toEqual({
      kind: "partner_owes_you",
      partnerName: "Leah",
      amount: "CHF 8.00",
    });
    expect(model.explanation).toEqual([
      { label: "Groceries", delta: "CHF 5.00" },
      { label: "Starting balance", delta: "CHF 3.00" },
    ]);
    expect(model.drafts).toEqual([
      {
        id: "draft",
        title: "Market shop",
        amount: "CHF 26.00",
        meta: "Due 11 Aug 2026",
        source: "Shopping",
        canConfirm: true,
      },
    ]);
    expect(model.events[0]).toEqual({
      id: "expense",
      title: "Groceries",
      meta: "Sam · 10 Aug 2026",
      amount: "CHF 10.00",
      type: "Expense",
    });
  });

  it("labels a negative viewer balance as money owed to the partner", () => {
    const model = mapMoneyViewModel(
      moneyInput({
        ledgerEntries: [
          {
            financial_event_id: "expense",
            member_id: partnerId,
            receivable_delta_cents: 500,
          },
          {
            financial_event_id: "expense",
            member_id: viewerId,
            receivable_delta_cents: -500,
          },
        ],
        events: [
          {
            id: "expense",
            type: "expense",
            occurred_on: "2026-08-10",
            created_at: "2026-08-10T10:00:00Z",
            created_by_member_id: partnerId,
            payer_member_id: partnerId,
            description: "Dinner",
            amount_cents: 1_000,
            related_event_id: null,
          },
        ],
        allocations: [
          {
            financial_event_id: "expense",
            member_id: viewerId,
            allocated_cents: 500,
          },
          {
            financial_event_id: "expense",
            member_id: partnerId,
            allocated_cents: 500,
          },
        ],
      }),
    );

    expect(model.hero).toEqual({
      kind: "you_owe_partner",
      partnerName: "Leah",
      amount: "CHF 5.00",
    });
    expect(model.explanation).toEqual([
      { label: "Dinner", delta: "-CHF 5.00" },
    ]);
  });

  it("shows a settled state without ledger entries", () => {
    expect(mapMoneyViewModel(moneyInput())).toEqual({
      hero: { kind: "settled" },
      explanation: [],
      drafts: [],
      events: [],
    });
  });

  it("rejects non-integer centimes at the database boundary", () => {
    expect(() =>
      parseMoneyReadRows({
        members: [],
        ledgerEntries: [
          {
            financial_event_id: "expense",
            member_id: viewerId,
            receivable_delta_cents: 1.5,
          },
        ],
        events: [],
        allocations: [],
        drafts: [],
      }),
    ).toThrow();
  });
});
