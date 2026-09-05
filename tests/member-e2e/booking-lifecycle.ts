import { expect, type Page } from "@playwright/test";

const bookingRegion = (page: Page) =>
  page.getByRole("region", { name: "CI updated flight", exact: true });

async function exerciseStaleBooking(alex: Page, sam: Page, tripUrl: string) {
  await alex.goto(tripUrl);
  await alex
    .getByRole("link", { name: "CI updated flight", exact: true })
    .click();
  await expect(bookingRegion(alex)).toBeVisible();
  const bookingUrl = alex.url();
  await alex.getByRole("link", { name: "Edit booking", exact: true }).click();
  await sam.goto(bookingUrl);
  await sam.getByRole("link", { name: "Edit booking", exact: true }).click();
  await sam.getByLabel(/^Notes/).fill("Sam's unsaved departure notes");
  await alex.getByLabel(/^Notes/).fill("Alex confirmed the departure");
  await alex.getByRole("button", { name: "Save booking", exact: true }).click();
  await expect(bookingRegion(alex)).toContainText(
    "Alex confirmed the departure",
  );
  await expect(sam.getByLabel(/^Notes/)).toHaveValue(
    "Sam's unsaved departure notes",
  );
  await sam.getByRole("button", { name: "Save booking", exact: true }).click();
  await expect(
    sam.getByRole("alert").filter({
      hasText:
        "This booking changed or is archived. Reload it before saving your edits.",
    }),
  ).toBeVisible();
  await expect(sam.getByLabel(/^Notes/)).toHaveValue(
    "Sam's unsaved departure notes",
  );
  const confirmation = sam.waitForEvent("dialog");
  const cancel = sam.getByRole("link", { name: "Cancel", exact: true }).click();
  const dialog = await confirmation;
  expect(dialog.message()).toBe("Discard your unsaved changes?");
  await dialog.accept();
  await cancel;
  await expect(bookingRegion(sam)).toContainText(
    "Alex confirmed the departure",
  );
}

async function exerciseBookingArchive(alex: Page, sam: Page, tripUrl: string) {
  await bookingRegion(alex)
    .locator("summary")
    .filter({
      hasText: /^Remove from the itinerary$/,
    })
    .click();
  await alex
    .getByRole("button", { name: "Archive booking", exact: true })
    .click();
  await expect(
    alex.getByRole("button", { name: "Restore booking", exact: true }),
  ).toBeVisible();
  await sam.goto(tripUrl);
  await expect(
    sam.getByRole("link", { name: "CI updated flight", exact: true }),
  ).toHaveCount(0);
  await expect(
    sam.getByRole("region", { name: "Paid expenses", exact: true }),
  ).toContainText("CHF 80.00");
  await sam
    .getByRole("link", { name: "View archived bookings", exact: true })
    .click();
  await sam
    .getByRole("link", { name: "CI updated flight", exact: true })
    .click();
  await sam
    .getByRole("button", { name: "Restore booking", exact: true })
    .click();
  await expect(
    sam.getByRole("link", { name: "Edit booking", exact: true }),
  ).toBeVisible();
}

async function exerciseTripArchive(alex: Page, sam: Page, tripUrl: string) {
  await alex.goto(tripUrl);
  await alex
    .getByRole("region", { name: "CI holiday", exact: true })
    .locator("summary")
    .filter({ hasText: /^Finished with this plan\?$/ })
    .click();
  await alex.getByRole("button", { name: "Archive plan", exact: true }).click();
  await expect(
    alex.getByRole("button", { name: "Restore plan", exact: true }),
  ).toBeVisible();
  await expect(bookingRegion(sam)).toContainText(
    "Restore the trip to change this booking.",
  );
  await expect(
    sam.getByRole("link", { name: "Edit booking", exact: true }),
  ).toHaveCount(0);
  await alex.getByRole("button", { name: "Restore plan", exact: true }).click();
  await expect(
    alex.getByRole("button", { name: "Restore plan", exact: true }),
  ).toHaveCount(0);
  await expect(
    sam.getByRole("link", { name: "Edit booking", exact: true }),
  ).toBeVisible();
  await sam.goto("/money");
  await expect(
    sam.getByRole("region", { name: "You owe Alex", exact: true }),
  ).toContainText("50.00");
}

export async function exerciseBookingLifecycle(
  alex: Page,
  sam: Page,
  tripUrl: string,
) {
  await exerciseStaleBooking(alex, sam, tripUrl);
  await exerciseBookingArchive(alex, sam, tripUrl);
  await exerciseTripArchive(alex, sam, tripUrl);
}
