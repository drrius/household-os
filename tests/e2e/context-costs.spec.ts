import { expect, test } from "@playwright/test";
test("costs show exact totals, payment details and booking links", async ({
  page,
}) => {
  await page.goto("/m7-fixture/context-costs");
  await expect(
    page.getByRole("heading", { name: "Our September trip" }),
  ).toBeVisible();
  await expect(
    page.getByText("CHF 180143985094819.82", { exact: true }),
  ).toBeVisible();
  await page.locator("summary").filter({ hasText: "Hotel deposit" }).click();
  await expect(page.getByText("Paid by Alex.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View booking costs" }),
  ).toHaveAttribute("href", /booking=00000000-0000-4000-8000-000000000002/);
  await expect(
    page.getByRole("link", { name: "Earlier activity" }),
  ).toHaveAttribute("href", /beforeOn=2026-09-04&beforeId=/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("empty and archived contexts have useful states", async ({ page }) => {
  await page.goto("/m7-fixture/context-costs?mode=empty");
  await expect(
    page.getByText("No paid expenses yet.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add expense", exact: true }),
  ).toBeVisible();
  await page.goto("/m7-fixture/context-costs?mode=archived");
  await expect(page.getByText("Paid costs · Archived")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add expense", exact: true }),
  ).toHaveCount(0);
});
test("expense errors keep values and the retry key, then return to costs", async ({
  page,
}) => {
  await page.goto("/m7-fixture/context-costs?mode=form");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Hotel deposit");
  await page.locator('[name="amount"]').fill("125.01");
  const key = await page.locator('[name="idempotencyKey"]').inputValue();
  await page.getByRole("button", { name: "Post expense", exact: true }).click();
  await expect(
    page.getByText("Connection interrupted. Keep these details and retry."),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Description", exact: true }),
  ).toHaveValue("Hotel deposit");
  await expect(page.locator('[name="amount"]')).toHaveValue("125.01");
  await expect(page.locator('[name="idempotencyKey"]')).toHaveValue(key);
  await page.locator('[name="note"]').fill("Retry");
  await page.getByRole("button", { name: "Post expense", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Expense saved." }),
  ).toBeVisible();
});
