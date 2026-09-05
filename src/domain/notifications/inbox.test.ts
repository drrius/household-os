import { expect, it } from "vitest";
import fc from "fast-check";
import {
  encodeInboxCursor,
  inboxBeforeFilter,
  inboxHref,
  inboxReadIds,
  parseInboxContext,
} from "./inbox";
import {
  emptyInboxCopy,
  presentInboxRow,
  type InboxRow,
} from "./inbox-presentation";
const id = "11111111-1111-4111-8111-111111111111";
it("round-trips microsecond cursors without losing the UUID tie-breaker", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 999999 }),
      fc.uuid(),
      (microseconds, uuid) => {
        const cursor = {
          createdAt: `2026-09-05T12:30:00.${String(microseconds).padStart(6, "0")}+00:00`,
          id: uuid,
        };
        expect(
          parseInboxContext({
            filter: "unread",
            cursor: encodeInboxCursor(cursor),
          }),
        ).toEqual({ filter: "unread", cursor });
        expect(inboxBeforeFilter(cursor)).toBe(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${uuid})`,
        );
        expect(inboxHref({ filter: "unread", cursor })).toContain(
          "filter=unread&cursor=",
        );
      },
    ),
  );
});
it("rejects invalid filters, forged cursors, arbitrary URLs and oversized batches", () => {
  for (const cursor of [
    "https://evil.example",
    "2026-09-05~bad",
    `2026-09-05T12:00:00Z),id.gt.0~${id}`,
    `${"x".repeat(90)}~${id}`,
  ])
    expect(() => parseInboxContext({ cursor })).toThrow();
  expect(() => parseInboxContext({ filter: "anything" })).toThrow();
  expect(() => inboxReadIds(Array(41).fill(id))).toThrow();
  expect(() => inboxReadIds(["not-a-uuid"])).toThrow();
  expect(inboxReadIds([id, id])).toEqual([id]);
});
it("links only validated available entities and ignores payload URLs", () => {
  const row: InboxRow = {
    id,
    kind: "partner_notice",
    activity_kind: "routine_updated",
    entity_type: "routine",
    entity_id: id,
    payload: { url: "https://evil.example", href: "javascript:alert(1)" },
    read_at: null,
    created_at: "2026-09-05T12:00:00Z",
  };
  expect(presentInboxRow(row, true).href).toBe(`/home/routines/${id}/edit`);
  expect(presentInboxRow(row, false).href).toBe("/home");
  expect(presentInboxRow({ ...row, entity_id: "../private" }, true).href).toBe(
    "/home",
  );
  expect(
    presentInboxRow({ ...row, entity_type: "meal_plan_entry" }, true).href,
  ).toBe(`/plan/meals/${id}`);
  expect(
    presentInboxRow({ ...row, entity_type: "financial_event" }, true).href,
  ).toBe("/money");
  expect(
    presentInboxRow({ ...row, entity_type: "expense_draft" }, true).href,
  ).toBe(`/money/expenses/new?draft=${id}`);
  expect(
    presentInboxRow({ ...row, entity_type: "expense_draft" }, false).href,
  ).toBe("/money");
});

it("does not claim caught-up when a concurrent notification changes the count", () => {
  expect(
    emptyInboxCopy({
      older: false,
      unreadOnly: true,
      totalCount: 6,
      unreadCount: 1,
    }).title,
  ).toBe("Your inbox changed");
  expect(
    emptyInboxCopy({
      older: false,
      unreadOnly: true,
      totalCount: 6,
      unreadCount: 0,
    }).title,
  ).toBe("You're caught up");
  expect(
    emptyInboxCopy({
      older: false,
      unreadOnly: false,
      totalCount: 0,
      unreadCount: 0,
    }).title,
  ).toBe("Nothing here yet");
});
