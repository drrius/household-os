import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./commands", () => ({
  saveCalendarEvent: vi.fn(),
  cancelCalendarEvent: vi.fn(),
  resolveCalendarConflict: vi.fn(),
}));
vi.mock("./sync", () => ({ syncAppleCalendar: vi.fn() }));
vi.mock("./connection", () => ({
  connectAppleCalendar: vi.fn(),
  selectAppleCalendar: vi.fn(),
  disconnectAppleCalendar: vi.fn(),
}));
import { connectCalendarAction } from "./actions";
import { connectAppleCalendar } from "./connection";
import { CalendarError } from "./errors";
it("never echoes Apple credentials into rejected action state", async () => {
  vi.mocked(connectAppleCalendar).mockRejectedValue(
    new CalendarError("authentication", "Check your app-specific password."),
  );
  const form = new FormData();
  form.set("username", "private@example.com");
  form.set("password", "aaaa-bbbb-cccc-dddd");
  const result = await connectCalendarAction({ submissionId: 0 }, form);
  expect(result).toEqual({
    submissionId: 1,
    error: "Check your app-specific password.",
  });
  expect(JSON.stringify(result)).not.toContain("private@example.com");
  expect(JSON.stringify(result)).not.toContain("aaaa-bbbb-cccc-dddd");
});
