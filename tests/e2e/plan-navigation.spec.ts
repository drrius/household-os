import { expect, test } from "@playwright/test";

test("the plan board keeps going past the last day of the week", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/m6-fixture/plan");

  const board = page.getByRole("region", {
    name: "Monday to Sunday meal board",
  });
  const nextWeek = board.getByRole("link", { name: "Next week, 17 – 23 Aug" });

  await expect(nextWeek).toHaveAttribute("href", "/plan?date=2026-08-17");
  await expect(
    page.getByRole("link", { name: "Previous week, 3 – 9 Aug" }),
  ).toHaveAttribute("href", "/plan?date=2026-08-03");

  // The carousel opens on the focused day and ends on the way out of the week.
  await expect(board.getByRole("article", { name: "Wed 12" })).toBeInViewport();
  await board.getByRole("article", { name: "Sun 16" }).scrollIntoViewIfNeeded();
  await expect(nextWeek).toBeInViewport();
});
