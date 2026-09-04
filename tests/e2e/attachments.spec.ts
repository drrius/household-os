import { expect, test } from "@playwright/test";

const path =
  "00000000-0000-4000-8000-000000000001/receipts/00000000-0000-4000-8000-000000000002.pdf";
const file = {
  name: "receipt.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\nfixture"),
};

test("receipt upload retains its path and excludes the binary from the parent form", async ({
  page,
}) => {
  await page.route("**/api/attachments", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ path }),
    }),
  );
  await page.goto("/m7-fixture/attachment");
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  await expect(page.locator('input[name="receiptPath"]')).toHaveValue(path);
  await expect(page.getByLabel("Receipt (optional)")).toHaveValue("");
  await page.getByRole("button", { name: "Remove attachment" }).click();
  await expect(page.locator('input[name="receiptPath"]')).toHaveValue("");
});

test("upload failures explain recovery and block accidental save", async ({
  page,
}) => {
  await page.route("**/api/attachments", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Couldn't upload the file. Please try again.",
      }),
    }),
  );
  await page.goto("/m7-fixture/attachment");
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(page.getByRole("status")).toContainText("Couldn't upload");
  expect(
    await page
      .getByLabel("Receipt (optional)")
      .evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(false);
  await page.getByRole("button", { name: "Remove attachment" }).click();
  expect(
    await page
      .getByLabel("Receipt (optional)")
      .evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(true);
});
