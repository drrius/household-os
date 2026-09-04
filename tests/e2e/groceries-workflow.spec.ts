import { expect, test } from "@playwright/test";

test("rapid grocery entry retains focus and failed entries remain recoverable", async ({
  page,
}, testInfo) => {
  await page.goto("/m7-fixture/groceries-workflow");
  const input = page.getByRole("textbox", { name: "Add grocery item" });
  await expect(
    page.getByRole("heading", { name: "Groceries", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("groceries.png"),
    fullPage: true,
  });
  await input.fill("Bread");
  await input.press("Enter");
  await expect(
    page.getByRole("link", { name: "Bread", exact: true }),
  ).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await input.fill("Eggs");
  await input.press("Enter");
  await expect(
    page.getByRole("link", { name: "Eggs", exact: true }),
  ).toBeVisible();
  await input.fill("Fail");
  await input.press("Enter");
  await expect(
    page.getByText("The connection dropped. Try again."),
  ).toBeVisible();
  await expect(input).toHaveValue("Fail");
});

test("cart claims update immediately and conflicts leave the partner's claim visible", async ({
  page,
}) => {
  await page.goto("/m7-fixture/groceries-workflow");
  await page.getByRole("checkbox", { name: "Add Apples to your cart" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Remove Apples from your cart" }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", { name: "Remove Apples from your cart" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Add Apples to your cart" }),
  ).not.toBeChecked();
  await page
    .getByRole("checkbox", { name: "Add Last avocado to your cart" })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Leah already has this item in her cart.",
  );
  await expect(
    page.getByRole("checkbox", { name: "Last avocado is in Leah's cart" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Last avocado is in Leah's cart" }),
  ).toBeDisabled();
});

test("purchased items can be put back on the active list", async ({ page }) => {
  await page.goto("/m7-fixture/groceries-workflow");
  await page.getByText("Purchased history", { exact: true }).click();
  await page.getByRole("button", { name: "Buy Milk again" }).click();
  await expect(
    page.getByRole("link", { name: "Milk", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Added to list" }),
  ).toBeDisabled();
});

test("checkout keeps a mixed receipt separate from a reviewed shared expense", async ({
  page,
}, testInfo) => {
  await page.goto("/m7-fixture/groceries-workflow");
  await page.getByRole("button", { name: "Show checkout" }).click();
  await page
    .getByRole("textbox", { name: "Receipt total in CHF" })
    .fill("104.80");
  await page
    .getByRole("checkbox", { name: "Create a shared expense draft" })
    .check();
  await page.getByRole("textbox", { name: "Amount in CHF" }).fill("80.01");
  await page
    .getByRole("button", { name: "Finish shopping", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("checkout.png"),
    fullPage: true,
  });
  const output = page.getByLabel("Saved checkout");
  await expect(output).toContainText('"receiptTotalCents":10480');
  await expect(output).toContainText('"sharedAmountCents":8001');
  await expect(output).toContainText('"allocatedCents":4001');
  await expect(output).toContainText('"allocatedCents":4000');
});
