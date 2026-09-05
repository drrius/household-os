import { asUserId } from "@/domain/identity";
import type { MoneyEventDetail } from "@/lib/read-models/money-event";
type Member = { user_id: string; display_name: string };
export const members: [Member, Member] = [
  { user_id: "00000000-0000-4000-8000-000000000001", display_name: "Darius" },
  { user_id: "00000000-0000-4000-8000-000000000002", display_name: "Partner" },
];
export const detail: MoneyEventDetail = {
  event: {
    id: "20000000-0000-4000-8000-000000000001",
    type: "expense",
    description: "Weekend groceries",
    amount_cents: 1001,
    occurred_on: "2026-09-05",
    created_at: "2026-09-05T10:00:00Z",
    payer_member_id: members[0].user_id,
    created_by_member_id: members[0].user_id,
    related_event_id: null,
    category_id: null,
    note: "Dinner ingredients and breakfast for Sunday.",
    receipt_path: null,
    shopping_session_id: null,
  },
  members,
  allocations: members.map((member, index) => ({
    financial_event_id: "20000000-0000-4000-8000-000000000001",
    member_id: member.user_id,
    allocated_cents: index ? 500 : 501,
  })),
  ledger: members.map((member, index) => ({
    member_id: member.user_id,
    receivable_delta_cents: index ? -500 : 500,
  })),
  related: [],
  parent: null,
  remaining: members.map((member, index) => ({
    memberId: member.user_id,
    allocatedCents: index ? 500 : 501,
  })),
  activeRefundCount: 0,
  hasExcessRefund: false,
  canCorrectOpening: false,
  isReversed: false,
  viewerId: asUserId(members[0].user_id),
  receiptPath:
    "10000000-0000-4000-8000-000000000001/receipts/30000000-0000-4000-8000-000000000001.jpg",
};

export const openingDetail: MoneyEventDetail = {
  ...detail,
  event: {
    ...detail.event,
    type: "opening_balance",
    description: "Starting balance",
    amount_cents: 12345,
    note: "Agreed starting point",
  },
  canCorrectOpening: true,
  allocations: [],
  remaining: [],
  receiptPath: null,
  ledger: members.map((member, index) => ({
    member_id: member.user_id,
    receivable_delta_cents: index ? -12345 : 12345,
  })),
};
export const excessRefundDetail: MoneyEventDetail = {
  ...detail,
  hasExcessRefund: true,
  activeRefundCount: 1,
  remaining: [
    { memberId: members[0].user_id, allocatedCents: 0 },
    { memberId: members[1].user_id, allocatedCents: 500 },
  ],
  related: [
    {
      ...detail.event,
      id: "20000000-0000-4000-8000-000000000002",
      type: "refund",
      description: "Earlier refund",
      amount_cents: 600,
      related_event_id: detail.event.id,
    },
  ],
};
