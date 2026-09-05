import { expect, test } from "@playwright/test";
test("prep refresh preserves dirty values, exact baseline and request identity", async ({
  page,
}) => {
  await page.goto("/m7-fixture/meal-prep-refresh");
  const title = page.getByLabel("What needs doing?");
  const version = page.locator('input[name="expectedUpdatedAt"]');
  const key = page.locator('input[name="idempotencyKey"]');
  const originalDue = page.locator('input[name="originalDueOn"]');
  await title.fill("My prep change");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(page.getByText("Server revision 2")).toBeVisible();
  await expect(title).toHaveValue("My prep change");
  await expect(version).toHaveValue("2026-09-05T00:00:00.000001Z");
  await expect(key).toHaveValue("00000000-0000-4000-8000-000000000191");
  await expect(originalDue).toHaveValue("2026-09-06");
  await page
    .getByRole("button", { name: "Save prep task", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "This prep task changed. Reopen it before saving.",
  );
  await expect(title).toHaveValue("My prep change");
  await page.getByRole("button", { name: "Open another prep task" }).click();
  await expect(title).toHaveValue("Prep 2");
  await expect(version).toHaveValue("2026-09-05T00:00:00.000002Z");
  await expect(originalDue).toHaveValue("2026-09-07");
});
