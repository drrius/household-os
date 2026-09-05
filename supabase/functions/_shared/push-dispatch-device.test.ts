import { drainRow, type OutboxRow } from "./push-dispatch-delivery.ts";

Deno.test(
  "self tests query one exact device; missing targets never fan out",
  async () => {
    for (const target of ["00000000-0000-4000-8000-000000000001", undefined]) {
      const filters: unknown[][] = [];
      const query = {
        select() {
          return this;
        },
        eq(...args: unknown[]) {
          filters.push(args);
          return this;
        },
        is() {
          return this;
        },
        overrideTypes() {
          return Promise.resolve({ data: [], error: null });
        },
      };
      const client = {
        from: () => query,
        rpc: () => ({
          overrideTypes: () => Promise.resolve({ data: true, error: null }),
        }),
      };
      const row = {
        id: "job",
        household_id: "home",
        recipient_member_id: "member",
        attempt_count: 0,
        claim_token: "claim",
        inbox_notification_id: null,
        delivered_subscription_ids: [],
        inbox: {
          id: "job",
          kind: "device_test",
          test_subscription_id: target,
          activity_kind: null,
          entity_type: null,
        },
      } satisfies OutboxRow;
      await drainRow(client as unknown as Parameters<typeof drainRow>[0], row, {
        kind: "missing",
        error: "fixture only",
      });
      const expected = [
        ["household_id", "home"],
        ["member_id", "member"],
        ["id", target ?? "00000000-0000-0000-0000-000000000000"],
      ];
      if (JSON.stringify(filters) !== JSON.stringify(expected))
        throw new Error("Device target was not enforced");
    }
  },
);

Deno.test(
  "ordinary jobs retain member-wide subscription selection",
  async () => {
    const filters: unknown[][] = [];
    const query = {
      select() {
        return this;
      },
      eq(...args: unknown[]) {
        filters.push(args);
        return this;
      },
      is() {
        return this;
      },
      overrideTypes() {
        return Promise.resolve({ data: [], error: null });
      },
    };
    const client = {
      from: () => query,
      rpc: () => ({
        overrideTypes: () => Promise.resolve({ data: true, error: null }),
      }),
    };
    const row = {
      id: "job",
      household_id: "home",
      recipient_member_id: "member",
      attempt_count: 0,
      claim_token: "claim",
      inbox_notification_id: "inbox",
      delivered_subscription_ids: [],
      inbox: {
        id: "inbox",
        kind: "household_digest",
        activity_kind: null,
        entity_type: null,
      },
    } satisfies OutboxRow;
    await drainRow(client as unknown as Parameters<typeof drainRow>[0], row, {
      kind: "missing",
      error: "fixture only",
    });
    if (
      JSON.stringify(filters) !==
      JSON.stringify([
        ["household_id", "home"],
        ["member_id", "member"],
      ])
    )
      throw new Error("Ordinary selection changed");
  },
);
