import { expect, test } from "@playwright/test";

test("project history exposes earlier values and navigates retained changes", async ({
  page,
}) => {
  await page.goto("/m7-fixture/project-history");
  await page.getByText("Alex updated Book the hotel", { exact: false }).click();
  await expect(
    page.getByText("Before: Call on Tuesday", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("After: Not set", { exact: true })).toBeVisible();
  await expect(page.getByText("After: Sam", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Before: CHF 5.01", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("After: CHF 8.00", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Older changes" }).click();
  await expect(page).toHaveURL(/historyPage=1#history$/);
  await expect(
    page.getByText("Alex updated Summer trip", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Newer changes" }).click();
  await expect(
    page.getByText("Alex updated Book the hotel", { exact: false }),
  ).toBeVisible();
});
