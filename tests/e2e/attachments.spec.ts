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
  await page.route("**/api/attachments**", (route) =>
    route.fulfill({
      status: route.request().method() === "DELETE" ? 204 : 201,
      contentType: "application/json",
      body:
        route.request().method() === "DELETE" ? "" : JSON.stringify({ path }),
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

test("a lost upload response can retry the same upload without creating a second file", async ({
  page,
}) => {
  const ids: string[] = [];
  await page.route("**/api/attachments", async (route) => {
    const body = route.request().postData() ?? "";
    const id = body.match(/name="uploadId"\r\n\r\n([^\r]+)/)?.[1] ?? "";
    ids.push(id);
    if (ids.length === 1) await route.abort("failed");
    else
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ path }),
      });
  });
  await page.goto("/m7-fixture/attachment");
  await page
    .getByLabel("Receipt (optional)")
    .setInputFiles({ ...file, mimeType: "" });
  await expect(
    page.getByRole("button", { name: "Retry upload" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry upload" }).click();
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  expect(ids).toHaveLength(2);
  expect(ids[0]).not.toBe("");
  expect(ids[1]).toBe(ids[0]);
});

test("replacing a ready attachment discards the previous temporary upload", async ({
  page,
}) => {
  const replacement = path.replace("000000000002.pdf", "000000000003.pdf");
  let uploads = 0;
  const discarded: string[] = [];
  await page.route("**/api/attachments**", async (route) => {
    if (route.request().method() === "DELETE") {
      discarded.push(
        new URL(route.request().url()).searchParams.get("path") ?? "",
      );
      await route.fulfill({ status: 204 });
    } else {
      uploads += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ path: uploads === 1 ? path : replacement }),
      });
    }
  });
  await page.goto("/m7-fixture/attachment");
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  expect(discarded).toEqual([path]);
  await expect(page.locator('input[name="receiptPath"]')).toHaveValue(
    replacement,
  );
});
