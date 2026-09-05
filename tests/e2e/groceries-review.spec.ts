import { expect, test } from "@playwright/test";
test("retained shopping history keeps its receipt and draft after item retention", async ({
  page,
}) => {
  await page.goto("/m7-fixture/groceries-review/retained");
  await expect(
    page.getByRole("heading", { name: "Shopping complete" }),
  ).toBeVisible();
  await expect(
    page.getByText("Purchased items are kept for 30 days.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View receipt" }),
  ).toHaveAttribute("href", /api\/attachments\?path=/);
  await expect(
    page.getByRole("link", { name: "Review shared expense" }),
  ).toHaveAttribute("href", /draft=draft$/);
});
test("cancelled sessions are explicit without pretending items were purchased", async ({
  page,
}) => {
  await page.goto("/m7-fixture/groceries-review/cancelled");
  await expect(
    page.getByRole("heading", { name: "Shopping cancelled" }),
  ).toBeVisible();
  await expect(page.getByText(/ended without purchasing/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Purchased items" }),
  ).toHaveCount(0);
});
test("checkout preserves category order before item position", async ({
  page,
}) => {
  await page.goto("/m7-fixture/groceries-review/ordering");
  await expect(page.getByRole("listitem")).toHaveText([
    "Apples3",
    "Pears2",
    "Bread1",
  ]);
});
test("late cancellation never reports items returned to the list", async ({
  page,
}) => {
  await page.goto("/m7-fixture/groceries-review/late-cancel");
  await page
    .getByRole("button", { name: "End session without purchasing" })
    .click();
  await expect(
    page.getByText(/This shopping session was already completed/),
  ).toBeVisible();
  await expect(
    page.getByText("Your items are back on the list", { exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/groceries-review\/late-cancel$/);
});
