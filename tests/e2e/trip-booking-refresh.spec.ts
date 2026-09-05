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

test("city suggestions preserve dirty booking versions and release a reverted selection", async ({
  page,
}) => {
  await page.goto("/m7-fixture/trips?view=concurrent");
  const zone = page.getByLabel("Start time zone", { exact: true });
  await zone.click();
  await zone.fill("London");
  await page
    .getByRole("option", { name: "Europe/London", exact: true })
    .click();
  await expect(zone).toHaveValue("Europe/London");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(page.locator('[name="updatedAt"]')).toHaveValue(
    "2026-09-05T12:00:01Z",
  );
  await page.getByRole("button", { name: "Save booking", exact: true }).click();
  await expect(
    page.getByText("Partner changed this booking. Reopen before saving."),
  ).toBeVisible();
  await expect(zone).toHaveValue("Europe/London");
  await zone.click();
  await zone.fill("Zurich");
  await page
    .getByRole("option", { name: "Europe/Zurich", exact: true })
    .click();
  await expect(page.getByLabel("Booking name")).toHaveValue("Flight 2");
  await expect(zone).toHaveValue("Europe/Zurich");
});

test("time zone suggestions support spaces, keyboard selection and empty results", async ({
  page,
}) => {
  await page.goto("/m7-fixture/trips?view=concurrent");
  const zone = page.getByLabel("Start time zone", { exact: true });
  await zone.click();
  await zone.fill("a city that does not exist");
  await expect(
    page.getByText("No matching city.", { exact: false }),
  ).toBeVisible();
  await zone.click();
  await zone.fill("New York");
  await expect(
    page.getByRole("option", { name: "America/New York", exact: true }),
  ).toBeVisible();
  await zone.press("ArrowDown");
  await zone.press("Enter");
  await expect(zone).toHaveValue("America/New_York");
  await expect(
    page.getByText("Partner changed this booking. Reopen before saving."),
  ).not.toBeVisible();
});
