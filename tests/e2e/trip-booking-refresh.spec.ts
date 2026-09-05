import { expect, test } from "@playwright/test";
test("pristine bookings receive current partner fields and versions", async ({
  page,
}) => {
  await page.goto("/m7-fixture/trips?view=concurrent");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(page.getByLabel("Booking name")).toHaveValue("Flight 2");
  await expect(page.locator('[name="updatedAt"]')).toHaveValue(
    "2026-09-05T12:00:02Z",
  );
});
test("dirty booking fields keep their baseline and adopt a waiting refresh after reverting", async ({
  page,
}) => {
  await page.goto("/m7-fixture/trips?view=concurrent");
  await page.getByLabel("Booking name").fill("My flight");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await page.getByRole("button", { name: "Save booking", exact: true }).click();
  await expect(
    page.getByText("Partner changed this booking. Reopen before saving."),
  ).toBeVisible();
  await expect(page.locator('[name="updatedAt"]')).toHaveValue(
    "2026-09-05T12:00:01Z",
  );
  await expect(page.getByLabel("Booking name")).toHaveValue("My flight");
  await page.getByLabel("Booking name").fill("Flight 1");
  await expect(page.getByLabel("Booking name")).toHaveValue("Flight 2");
  await expect(page.locator('[name="updatedAt"]')).toHaveValue(
    "2026-09-05T12:00:02Z",
  );
});
test("new booking identity survives refresh and a rejected submission", async ({
  page,
}) => {
  await page.goto("/m7-fixture/trips?view=new-refresh");
  const id = await page.locator('[name="id"]').inputValue();
  await page.getByLabel("Booking name").fill("Another flight");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(page.locator('[name="id"]')).toHaveValue(id);
  await page.getByRole("button", { name: "Add booking", exact: true }).click();
  await expect(page.getByText("Keep this draft and try again.")).toBeVisible();
  await expect(page.locator('[name="id"]')).toHaveValue(id);
  await expect(page.getByLabel("Booking name")).toHaveValue("Another flight");
});
