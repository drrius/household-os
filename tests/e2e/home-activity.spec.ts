import { expect, test } from "@playwright/test";

test("Home activity explains saved record changes from both members", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem("household-os:welcome-dismissed", "1"),
  );
  await page.goto("/m7-fixture/home-activity");
  const activity = page.getByRole("list", {
    name: "Recent household activity",
  });
  await activity.scrollIntoViewIfNeeded();
  await expect(activity.getByRole("listitem")).toHaveCount(4);
  for (const text of [
    "Robin added item: Washing machine",
    "Alex updated commitment: Internet subscription",
    "Robin archived document: Old manual",
    "Alex restored contact: Repair service",
  ])
    await expect(activity.getByText(text, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("home-activity.png") });
});
