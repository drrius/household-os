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

test("opening details identify the creditor and remain correctable after reversal", async ({
  page,
}) => {
  for (const screen of ["opening-detail", "opening-reversed"]) {
    await page.goto(`/m7-fixture/money/${screen}`);
    await expect(page.getByText(/Owed to Darius/)).toBeVisible();
    await expect(page.getByText(/Paid by Darius/)).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Correct opening balance" }),
    ).toHaveAttribute("href", /correct$/);
    await expect(page.getByRole("link", { name: "Record refund" })).toHaveCount(
      0,
    );
  }
});
test("opening correction preserves creditor, amount, note and idempotency after rejection", async ({
  page,
}) => {
  await page.goto("/m7-fixture/money/opening-repair");
  await expect(
    page.getByRole("button", { name: "Record reversal", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Amount in CHF")).toHaveValue("123.45");
  const key = await page.locator('input[name="idempotencyKey"]').inputValue();
  await page.getByLabel("Amount in CHF").fill("200.01");
  await expect(page.getByText(/Partner will owe Darius/)).toBeVisible();
  await page
    .getByRole("button", { name: "Save opening balance correction" })
    .click();
  await expect(
    page.getByText("Validated. This fixture does not post to a household."),
  ).toBeVisible();
  await expect(page.getByLabel("Amount in CHF")).toHaveValue("200.01");
  await expect(page.getByLabel(/^Note/)).toHaveValue("Agreed starting point");
  await expect(page.locator('input[name="idempotencyKey"]')).toHaveValue(key);
});
test("legacy over-refunds remain readable with a reversal path", async ({
  page,
}) => {
  await page.goto("/m7-fixture/money/legacy-refund");
  await expect(page.getByText(/Earlier refunds exceed/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Earlier refund/ }),
  ).toHaveAttribute("href", /events\/20000000-0000-4000-8000-000000000002$/);
  await expect(page.getByRole("link", { name: "Record refund" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "How it affects you both" }),
  ).toBeVisible();
});
