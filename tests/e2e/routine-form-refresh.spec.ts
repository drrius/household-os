import { expect, test } from "@playwright/test";
test("routine refresh preserves its dirty values, exact baseline and retry key", async ({
  page,
}) => {
  await page.goto("/m7-fixture/routine-form-refresh");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("My routine");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(page.getByText("Server revision 2")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("My routine");
  await expect(page.locator('[name="expectedUpdatedAt"]')).toHaveValue(
    "2026-09-05T00:00:00.000001Z",
  );
  await expect(page.locator('[name="idempotencyKey"]')).toHaveValue("key-1");
  await page.getByRole("button", { name: "Save routine" }).click();
  await expect(
    page.getByText("This routine changed. Reopen it before saving."),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("My routine");
  await expect(page.locator('[name="idempotencyKey"]')).toHaveValue("key-1");
  await page.getByRole("button", { name: "Open another routine" }).click();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("Routine 2");
  await expect(page.locator('[name="expectedUpdatedAt"]')).toHaveValue(
    "2026-09-05T00:00:00.000002Z",
  );
  await expect(page.locator('[name="idempotencyKey"]')).toHaveValue("key-2");
});
