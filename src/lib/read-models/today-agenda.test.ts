import { expect, it, vi } from "vitest";
const { agenda } = vi.hoisted(() => ({ agenda: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./household-agenda", () => ({ loadHouseholdAgenda: agenda }));
import { redirect } from "next/navigation";
import { loadTodayAgenda } from "./today-agenda";

it("preserves the successfully loaded agenda", async () => {
  const model = {
    today: "2026-09-05",
    entries: [],
    warnings: [],
    syncAttention: 0,
  };
  agenda.mockResolvedValueOnce(model);
  expect(await loadTodayAgenda(model.today)).toBe(model);
});
it.each(["database unavailable", "too many plans"])(
  "reports unavailable agenda for %s",
  async (reason) => {
    agenda.mockRejectedValueOnce(new Error(reason));
    expect(await loadTodayAgenda("2026-09-05")).toBeNull();
  },
);
it("preserves authentication redirects instead of treating them as an agenda outage", async () => {
  agenda.mockImplementationOnce(() => redirect("/sign-in"));
  await expect(loadTodayAgenda("2026-09-05")).rejects.toMatchObject({
    digest: expect.stringContaining("NEXT_REDIRECT"),
  });
});
