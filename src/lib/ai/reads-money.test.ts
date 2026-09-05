import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({
    householdId: "household",
    userId: "viewer",
  })),
}));
vi.mock("@/lib/ai/reads", () => ({
  memberDirectory: vi.fn(async () => []),
  requireRows: (_: string, result: { data: unknown }) => result.data,
}));
vi.mock("@/lib/ai/execute/money-snapshots", () => ({
  fetchAllLedgerRows: vi.fn(async () => []),
  toLedgerEntries: vi.fn(() => []),
}));
const fixture = vi.hoisted(() => ({
  filters: [] as string[],
  orders: [] as string[],
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
      let cursor: string | null = null;
      let limit = 1000;
      const rows = Array.from({ length: 41 }, (_, index) => ({
        id: `11111111-1111-4111-8111-${String(41 - index).padStart(12, "0")}`,
        occurred_on: "2026-09-05",
        created_at: "2026-09-05T10:00:00+00:00",
      }));
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: (field: string) => {
          if (table === "financial_events") fixture.orders.push(field);
          return query;
        },
        limit: (value: number) => {
          limit = value;
          return query;
        },
        or: (filter: string) => {
          fixture.filters.push(filter);
          cursor = /id\.lt\.([0-9a-f-]+)/.exec(filter)?.[1] ?? null;
          return query;
        },
        then: (resolve: (value: unknown) => unknown) =>
          resolve({
            data:
              table === "financial_events"
                ? rows
                    .filter((row) => !cursor || row.id < cursor)
                    .slice(0, limit)
                : [],
            error: null,
          }),
      };
      return query;
    },
  })),
}));
import { readMoneyOverview } from "./reads-money";
import type { FinancialHistoryCursor } from "@/domain/money/history-cursor";
it("returns every same-day, same-instant event across pages without dropping ID ties", async () => {
  const first = await readMoneyOverview({});
  const second = await readMoneyOverview({
    eventsCursor: first.nextEventsCursor as FinancialHistoryCursor,
  });
  const third = await readMoneyOverview({
    eventsCursor: second.nextEventsCursor as FinancialHistoryCursor,
  });
  const ids = [first, second, third].flatMap((page) =>
    (page.recentEvents as { id: string }[]).map((event) => event.id),
  );
  expect(ids).toHaveLength(41);
  expect(new Set(ids).size).toBe(41);
  expect(third.nextEventsCursor).toBeNull();
  expect(fixture.filters[0]).toContain("occurred_on.eq.2026-09-05");
  expect(fixture.filters[0]).toContain(
    "created_at.eq.2026-09-05T10:00:00+00:00",
  );
  expect(fixture.orders.slice(0, 3)).toEqual([
    "occurred_on",
    "created_at",
    "id",
  ]);
});
