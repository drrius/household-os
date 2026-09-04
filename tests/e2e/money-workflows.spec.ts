import { expect, test } from "@playwright/test";

test("event details explain both shares, receipt and financial effect", async ({
  page,
}) => {
  await page.goto("/m7-fixture/money/detail");
  await expect(
    page.getByRole("heading", { name: "Weekend groceries" }),
  ).toBeVisible();
  await expect(
    page.getByText("Dinner ingredients and breakfast for Sunday."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How it affects you both" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /View receipt/ }),
  ).toHaveAttribute("href", /\/api\/attachments\?path=/);
  await expect(
    page.getByRole("link", { name: "Record refund" }),
  ).toHaveAttribute("href", /\/refund$/);
  await expect(
    page.getByRole("link", { name: "Correct or reverse" }),
  ).toHaveAttribute("href", /\/correct$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("partial refund previews shares and preserves fields after a server response", async ({
  page,
}) => {
  await page.goto("/m7-fixture/money/refund");
  await page.getByLabel("Refund amount in CHF").fill("5.01");
  await expect(
    page.getByText("Darius: CHF 2.50", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Partner: CHF 2.51", { exact: true }),
  ).toBeVisible();
  const key = await page.locator('input[name="idempotencyKey"]').inputValue();
  await page.getByLabel(/^Note/).fill("Returned the unopened item");
  await page
    .getByRole("button", { name: "Record refund", exact: true })
    .click();
  await expect(
    page.getByText("Validated. This fixture does not post to a household."),
  ).toBeVisible();
  await expect(page.getByLabel("Refund amount in CHF")).toHaveValue("5.01");
  await expect(page.getByLabel(/^Note/)).toHaveValue(
    "Returned the unopened item",
  );
  await expect(page.locator('input[name="idempotencyKey"]')).toHaveValue(key);
});

test("correction retains existing note, shares and receipt", async ({
  page,
}) => {
  await page.goto("/m7-fixture/money/correction");
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Weekend groceries",
  );
  await expect(page.getByLabel(/^Note/)).toHaveValue(
    "Dinner ingredients and breakfast for Sunday.",
  );
  await expect(
    page.getByRole("link", { name: "View attachment" }),
  ).toBeVisible();
  await page
    .getByLabel("Description", { exact: true })
    .fill("Corrected groceries");
  await page
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect(
    page.getByText("Validated. This fixture does not post to a household."),
  ).toBeVisible();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Corrected groceries",
  );
  await expect(
    page.getByRole("link", { name: "View attachment" }),
  ).toBeVisible();
});

test("recurring expenses explain drafts and validate month-end dates", async ({
  page,
}) => {
  await page.goto("/m7-fixture/money/recurring");
  await page.getByLabel("Description", { exact: true }).fill("Rent");
  await page.getByLabel("Amount in CHF").fill("1600.00");
  await page.getByLabel("Day of the month", { exact: true }).fill("31");
  await page
    .getByRole("button", { name: "Create recurring expense", exact: true })
    .click();
  await expect(
    page
      .getByText(
        "The next draft date must match the monthly day, or the last day of a shorter month.",
      )
      .first(),
  ).toBeVisible();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Rent",
  );
  await expect(page.getByText(/You review each draft/)).toBeVisible();
});
