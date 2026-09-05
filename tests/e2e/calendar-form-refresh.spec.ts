import { expect, test } from "@playwright/test";
test("calendar refresh cannot advance a dirty event's version or reset its dates", async ({
  page,
}) => {
  await page.goto("/m7-fixture/calendar-form-refresh");
  await page.locator('[name="title"]').fill("My event");
  await page.locator('[name="start"]').fill("2026-09-01T13:00");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(page.locator('[name="version"]')).toHaveValue("v1");
  await expect(page.locator('[name="title"]')).toHaveValue("My event");
  await expect(page.locator('[name="start"]')).toHaveValue("2026-09-01T13:00");
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(
    page.getByText("Partner changed this event. Reopen it before saving."),
  ).toBeVisible();
  await expect(page.locator('[name="title"]')).toHaveValue("My event");
  await expect(page.locator('[name="version"]')).toHaveValue("v1");
  await page.getByRole("button", { name: "Open another event" }).click();
  await expect(page.locator('[name="title"]')).toHaveValue("Event 2");
  await expect(page.locator('[name="version"]')).toHaveValue("v2");
});
test("switching recurrence target starts a new event edit snapshot", async ({
  page,
}) => {
  await page.goto("/m7-fixture/calendar-form-refresh");
  await page.locator('[name="title"]').fill("Unsaved master title");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await page.getByRole("button", { name: "Open another occurrence" }).click();
  await expect(page.locator('[name="title"]')).toHaveValue("Event 2");
  await expect(page.locator('[name="version"]')).toHaveValue("v2");
  await expect(page.locator('[name="recurrenceId"]')).toHaveValue(
    "20260908T100000",
  );
});
