import { expect, test } from "@playwright/test";

test("saved meal pristine refresh pairs fields with the current version", async ({
  page,
}) => {
  await page.goto("/m7-fixture/library-refresh");
  const editor = page.getByRole("region", { name: "Existing meal" });
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.getByLabel("Meal name")).toHaveValue("Pasta 2");
  await editor.getByRole("button", { name: "Save meal" }).click();
  await expect(editor.getByRole("alert")).toContainText(
    "Current snapshot accepted",
  );
});

test("saved meal dirty edits retain their version through rejection and can be reverted", async ({
  page,
}) => {
  await page.goto("/m7-fixture/library-refresh");
  const editor = page.getByRole("region", { name: "Existing meal" });
  await editor.getByLabel("Meal name").fill("My pasta");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.getByLabel("Meal name")).toHaveValue("My pasta");
  await editor.getByRole("button", { name: "Save meal" }).click();
  await expect(editor.getByRole("alert")).toContainText(
    "Partner changed this meal",
  );
  await editor.getByLabel("Meal name").fill("Pasta 1");
  await expect(editor.getByLabel("Meal name")).toHaveValue("Pasta 2");
  await editor.getByRole("button", { name: "Save meal" }).click();
  await expect(editor.getByRole("alert")).toContainText(
    "Current snapshot accepted",
  );
});

for (const [region, name, idField, button] of [
  ["New meal", "Meal name", "libraryId", "Save meal"],
  ["New default grocery", "Item", "templateId", "Add default grocery"],
]) {
  test(`${region} identity survives refresh, rejection and retry`, async ({
    page,
  }) => {
    await page.goto("/m7-fixture/library-refresh");
    const editor = page.getByRole("region", { name: region });
    const input = editor.locator(`[name="${idField}"]`);
    const original = await input.inputValue();
    await editor.getByLabel(name!, { exact: true }).fill("New entry");
    await page
      .getByRole("button", { name: "Simulate partner refresh" })
      .click();
    await expect(input).toHaveValue(original);
    await editor.getByRole("button", { name: button }).click();
    await expect(editor.getByRole("alert")).toContainText("Uncertain creation");
    await expect(input).toHaveValue(original);
    await expect(editor.getByLabel(name!, { exact: true })).toHaveValue(
      "New entry",
    );
    await page
      .getByRole("button", { name: "Simulate partner refresh" })
      .click();
    await editor.getByRole("button", { name: button }).click();
    await expect(input).toHaveValue(original);
  });
}
