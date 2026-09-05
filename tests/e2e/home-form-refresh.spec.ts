import { expect, test } from "@playwright/test";
test("Home edits keep their initial version through refresh and failed submission", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-form-refresh");
  const editor = page.getByRole("region", { name: "Existing record" });
  await editor.locator('[name="name"]').fill("My contact");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="version"]')).toHaveValue("v1");
  await expect(editor.locator('[name="name"]')).toHaveValue("My contact");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(
    editor.getByText("Partner changed this record. Reopen it before saving."),
  ).toBeVisible();
  await expect(editor.locator('[name="name"]')).toHaveValue("My contact");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="version"]')).toHaveValue("v1");
  await page.getByRole("button", { name: "Open another record" }).click();
  await expect(editor.locator('[name="version"]')).toHaveValue("v3");
  await expect(editor.locator('[name="name"]')).toHaveValue("Contact 3");
});
test("new Home record keeps its generated identity during refresh and validation retry", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-form-refresh");
  const editor = page.getByRole("region", { name: "New record" });
  const originalId = await editor.locator('[name="id"]').inputValue();
  await editor.locator('[name="name"]').fill("New contact");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="id"]')).toHaveValue(originalId);
  await expect(editor.locator('[name="name"]')).toHaveValue("New contact");
  await editor.getByRole("button", { name: "Add contact" }).click();
  await expect(
    editor.getByText("Validation failed; keep your draft"),
  ).toBeVisible();
  await expect(editor.locator('[name="id"]')).toHaveValue(originalId);
  await expect(editor.locator('[name="name"]')).toHaveValue("New contact");
});

test("a fresh same-page navigation starts a new record lifetime", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-form-refresh");
  const editor = page.getByRole("region", { name: "New record" });
  const originalId = await editor.locator('[name="id"]').inputValue();
  await editor.locator('[name="name"]').fill("Earlier draft");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await page
    .getByRole("button", { name: "Finish and reopen this page" })
    .click();
  await expect(editor.locator('[name="name"]')).toHaveValue("");
  await expect(editor.locator('[name="id"]')).not.toHaveValue(originalId);
});
