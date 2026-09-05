import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  mark: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/notifications/inbox-commands", () => ({
  markInboxPageRead: mock.mark,
}));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mock.redirect }));
import { markInboxPageReadAction } from "@/app/(product)/_actions/inbox";
const id = "11111111-1111-4111-8111-111111111111";
function form() {
  const data = new FormData();
  data.set("notificationId", id);
  data.set("filter", "unread");
  data.set("cursor", `2026-09-05T12:00:00.123456Z~${id}`);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.mark.mockResolvedValue(undefined);
  mock.redirect.mockImplementation(() => {
    throw new Error("redirect");
  });
});
it("preserves filter and cursor and refreshes Today only after authoritative success", async () => {
  await expect(
    markInboxPageReadAction({ submissionId: 0 }, form()),
  ).rejects.toThrow("redirect");
  expect(mock.revalidate).toHaveBeenCalledWith("/");
  expect(mock.revalidate).toHaveBeenCalledWith("/home/inbox");
  expect(mock.redirect.mock.calls[0]?.[0]).toContain(
    "filter=unread&cursor=2026-09-05T12%3A00%3A00.123456Z",
  );
});
it("retains recoverable errors and refuses forged navigation context", async () => {
  mock.mark.mockRejectedValue(new Error("Try again"));
  expect(
    await markInboxPageReadAction({ submissionId: 0 }, form()),
  ).toMatchObject({ error: "Try again", submissionId: 1 });
  expect(mock.revalidate).not.toHaveBeenCalled();
  expect(mock.redirect).not.toHaveBeenCalled();
  const forged = form();
  forged.set("cursor", "https://evil.example");
  mock.mark.mockClear();
  expect(
    await markInboxPageReadAction({ submissionId: 1 }, forged),
  ).toHaveProperty("error");
  expect(mock.mark).not.toHaveBeenCalled();
});
