import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
test("two consecutive saved-meal edits use the accepted server version", async ({
  page,
}) => {
  await page.goto(`/m7-fixture/library-save?run=${randomUUID()}`);
  const editor = page.getByRole("region", { name: "Existing meal" });
  await editor.locator('[name="name"]').fill("New pasta");
  await editor.getByRole("button", { name: "Save meal" }).click();
  await expect(editor.locator('[name="version"]')).toHaveValue(
    "2026-09-05T00:00:02Z",
  );
  await editor.locator('[name="name"]').fill("Another pasta");
  await editor.getByRole("button", { name: "Save meal" }).click();
  await expect(editor.locator('[name="version"]')).toHaveValue(
    "2026-09-05T00:00:03Z",
  );
  await expect(editor.locator('[name="name"]')).toHaveValue("Another pasta");
});
test("confirmed default grocery creation starts a fresh form identity", async ({
  page,
}) => {
  await page.goto(`/m7-fixture/library-save?run=${randomUUID()}`);
  const editor = page.getByRole("region", { name: "New default grocery" });
  const first = await editor.locator('[name="templateId"]').inputValue();
  await editor.locator('[name="name"]').fill("Pasta");
  await editor.getByRole("button", { name: "Add default grocery" }).click();
  await expect(page.getByText("Groceries added: 1")).toBeVisible();
  await expect(editor.locator('[name="templateId"]')).not.toHaveValue(first);
  await expect(editor.locator('[name="name"]')).toHaveValue("");
  await editor.locator('[name="name"]').fill("Tomatoes");
  await editor.getByRole("button", { name: "Add default grocery" }).click();
  await expect(page.getByText("Groceries added: 2")).toBeVisible();
});
