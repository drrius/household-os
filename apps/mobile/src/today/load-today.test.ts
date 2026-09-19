import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadToday } from "./load-today";

const { request } = vi.hoisted(() => ({ request: vi.fn<typeof fetch>() }));

vi.mock("../lib/supabase", () => ({
  supabase: createClient("https://example.supabase.co", "public-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: request },
  }),
}));

const session = {
  status: "ready",
  householdId: "household-1",
  userId: "user-1",
  displayName: "Alex",
} as const;

afterEach(() => {
  vi.useRealTimers();
  request.mockReset();
});

describe("Today database loading", () => {
  it("loads household data with the completion table's occurrence_id key", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T10:00:00Z"));
    request.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      const table = url.pathname.split("/").at(-1);
      if (table === "routine_completions") {
        // Match the real schema: this table has occurrence_id, never id.
        if (url.searchParams.get("select") !== "occurrence_id") {
          return Response.json(
            {
              code: "42703",
              message: "column routine_completions.id does not exist",
            },
            { status: 400 },
          );
        }
        return new Response(null, {
          headers: { "content-range": "0-1/2" },
        });
      }
      if (init?.method === "HEAD") {
        return new Response(null, { headers: { "content-range": "*/0" } });
      }
      if (table === "household_members") {
        return Response.json([
          { user_id: "user-1", display_name: "Alex" },
          { user_id: "user-2", display_name: "Sam" },
        ]);
      }
      if (table === "routine_occurrences") {
        return Response.json([
          {
            id: "routine-1",
            due_date: "2026-09-19",
            planned_assignee_id: "user-1",
            routine: { title: "Feed the cat", priority: "pet_care" },
          },
        ]);
      }
      return Response.json([]);
    });

    const { model } = await loadToday(session);

    expect(model.completedCount).toBe(2);
    expect(model.totalCount).toBe(3);
    expect(model.routinesToday).toEqual([
      expect.objectContaining({
        occurrenceId: "routine-1",
        title: "Feed the cat",
      }),
    ]);
    expect(model.greetingName).toBe("Alex");
  });

  it("reports a database failure instead of showing an empty household", async () => {
    request.mockImplementation(async () =>
      Response.json({ message: "Permission denied" }, { status: 403 }),
    );

    await expect(loadToday(session)).rejects.toThrow(
      "Members: Permission denied",
    );
  });
});
