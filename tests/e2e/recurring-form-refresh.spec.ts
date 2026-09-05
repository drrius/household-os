import { expect, test } from "@playwright/test";
test("recurring edits keep version, date and idempotency key with dirty values", async ({
  page,
}) => {
  await page.goto("/m7-fixture/recurring-form-refresh");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("My rent");
  await page
    .getByRole("button", { name: "Simulate partner or scheduler refresh" })
    .click();
  await expect(page.getByText("Server revision 2")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Description", exact: true }),
  ).toHaveValue("My rent");
  await expect(page.locator('[name="expectedUpdatedAt"]')).toHaveValue(
    "2026-09-05T00:00:00.000001Z",
  );
  await expect(page.locator('[name="idempotencyKey"]')).toHaveValue("key-1");
  await expect(page.locator('[name="occurredOn"]')).toHaveValue("2026-10-01");
  await page.getByRole("button", { name: "Save recurring expense" }).click();
  await expect(
    page.getByText("This recurring expense changed. Reopen it before saving."),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Description", exact: true }),
  ).toHaveValue("My rent");
  await expect(page.locator('[name="idempotencyKey"]')).toHaveValue("key-1");
  await page.getByRole("button", { name: "Open another rule" }).click();
  await expect(
    page.getByRole("textbox", { name: "Description", exact: true }),
  ).toHaveValue("Rent 2");
  await expect(page.locator('[name="expectedUpdatedAt"]')).toHaveValue(
    "2026-09-05T00:00:00.000002Z",
  );
  await expect(page.locator('[name="occurredOn"]')).toHaveValue("2026-11-01");
  await expect(page.locator('[name="idempotencyKey"]')).toHaveValue("key-2");
});
