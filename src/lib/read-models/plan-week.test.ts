import { expect, it, vi } from "vitest";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./planning-sources", () => ({
  loadPlanningSources: load,
  readPages: vi.fn(),
}));
vi.mock("@/lib/calendar/agenda", () => ({ loadCalendarOccurrences: vi.fn() }));
import { redirect } from "next/navigation";
import { loadHouseholdWeekOrNull } from "./plan-week";

it("reports an unavailable week instead of failing the meal board", async () => {
  load.mockRejectedValueOnce(new Error("database unavailable"));
  expect(await loadHouseholdWeekOrNull("2026-09-07", "2026-09-09")).toBeNull();
});

it("preserves authentication redirects", async () => {
  load.mockImplementationOnce(() => redirect("/sign-in"));
  await expect(
    loadHouseholdWeekOrNull("2026-09-07", "2026-09-09"),
  ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
});
