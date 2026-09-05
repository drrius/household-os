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

test("untouched Home fields accept partner values and versions", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-form-refresh");
  const editor = page.getByRole("region", { name: "Existing record" });
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="name"]')).toHaveValue("Contact 2");
  await expect(editor.locator('[name="version"]')).toHaveValue("v2");
});
test("reverting a Home draft adopts the waiting partner update", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-form-refresh");
  const editor = page.getByRole("region", { name: "Existing record" });
  await editor.locator('[name="name"]').fill("My draft");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await editor.locator('[name="name"]').fill("Contact 1");
  await expect(editor.locator('[name="name"]')).toHaveValue("Contact 2");
  await expect(editor.locator('[name="version"]')).toHaveValue("v2");
});
test("selection-only edits preserve matching options and release after reverting", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-form-refresh");
  const editor = page.getByRole("region", { name: "Commitment record" });
  await editor.locator('[name="responsible_member_id"]').selectOption("sam");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="version"]')).toHaveValue("v1");
  await expect(editor.locator('option[value="alex"]')).toHaveText("Alex 1");
  await editor.locator('[name="responsible_member_id"]').selectOption("alex");
  await expect(editor.locator('[name="version"]')).toHaveValue("v2");
  await expect(editor.locator('option[value="alex"]')).toHaveText("Alex 2");
});

test("pristine new records keep their ID while receiving current choices", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-form-refresh");
  const editor = page.getByRole("region", {
    name: "New commitment",
    exact: true,
  });
  const id = await editor.locator('[name="id"]').inputValue();
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('option[value="alex"]')).toHaveText("Alex 2");
  await expect(editor.locator('[name="id"]')).toHaveValue(id);
});
test("new-record choices freeze only for an actual draft and refresh after reverting", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-form-refresh");
  const editor = page.getByRole("region", {
    name: "New commitment",
    exact: true,
  });
  const id = await editor.locator('[name="id"]').inputValue();
  await editor.locator('[name="responsible_member_id"]').selectOption("sam");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('option[value="alex"]')).toHaveText("Alex 1");
  await expect(editor.locator('[name="responsible_member_id"]')).toHaveValue(
    "sam",
  );
  await editor.locator('[name="responsible_member_id"]').selectOption("");
  await expect(editor.locator('option[value="alex"]')).toHaveText("Alex 2");
  await expect(editor.locator('[name="id"]')).toHaveValue(id);
});
