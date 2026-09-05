import { expect, test } from "@playwright/test";
test("pristine attachments adopt refresh but removing one preserves the edit", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-form-refresh");
  const editor = page.getByRole("region", { name: "Document record" });
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="file_path"]')).toHaveValue(
    "household/documents/manual-2.pdf",
  );
  await editor.getByRole("button", { name: "Remove attachment" }).click();
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="version"]')).toHaveValue("v2");
  await expect(editor.locator('[name="file_path"]')).toHaveValue("");
});
test("an upload survives partner refresh and keeps the original edit version", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/attachments", async (route) => {
    requests++;
    await held;
    await route.fulfill({ json: { path: "household/documents/uploaded.pdf" } });
  });
  await page.goto("/m7-fixture/home-form-refresh");
  const editor = page.getByRole("region", { name: "Document record" });
  await editor.locator('[type="file"]').setInputFiles({
    name: "manual.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 fixture"),
  });
  await expect(editor.getByText("Uploading…", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.getByText("Uploading…", { exact: true })).toBeVisible();
  await expect(editor.locator('[name="version"]')).toHaveValue("v1");
  release();
  await expect(editor.locator('[name="file_path"]')).toHaveValue(
    "household/documents/uploaded.pdf",
  );
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="version"]')).toHaveValue("v1");
  await expect(editor.locator('[name="file_path"]')).toHaveValue(
    "household/documents/uploaded.pdf",
  );
  expect(requests).toBe(1);
});
