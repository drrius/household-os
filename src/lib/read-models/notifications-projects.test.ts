import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: async () => ({
    userId: "member-b",
    householdId: "home",
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { loadInboxFeed } from "./notifications";

describe("project assignment inbox destination", () => {
  it.each(["41000200-0000-4000-8000-000000000001", "//evil.invalid"])(
    "renders the stored task and safely handles project %s",
    async (projectId) => {
      const row = {
        id: "notice",
        kind: "partner_notice",
        activity_kind: "project_task_assigned",
        entity_type: "project_task",
        entity_id: "41000300-0000-4000-8000-000000000001",
        payload: { project_id: projectId, title: "Book the hotel" },
        read_at: null,
        created_at: "2026-09-05T09:00:00Z",
      };
      mocks.client.mockResolvedValue({
        from: () => {
          const query = {
            select: () => query,
            eq: () => query,
            is: () => query,
            order: () => query,
            limit: () => query,
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve({ data: [row], count: 1, error: null }).then(
                resolve,
              ),
          };
          return query;
        },
      });
      const feed = await loadInboxFeed();
      expect(feed.items[0]).toMatchObject({
        title: "Task assigned to you",
        body: "Book the hotel",
        href: projectId.startsWith("//")
          ? "/home"
          : `/plan/projects/${projectId}/tasks/41000300-0000-4000-8000-000000000001`,
        read: false,
      });
    },
  );
});
