import { expect, test } from "@playwright/test";
test("a flight preserves local departure/arrival zones and exact estimated cost", async ({
  page,
}) => {
  await page.goto("/m7-fixture/trips");
  await page.getByLabel("Booking name").fill("Holiday flight");
  await page.getByText("Dates, times and places", { exact: true }).click();
  await page.getByLabel("Start (local date and time)").fill("2026-09-05T10:00");
  await page.getByLabel("End (local date and time)").fill("2026-09-05T13:00");
  await page
    .getByLabel("End time zone", { exact: true })
    .fill("America/New_York");
  await page
    .getByText("Confirmation and expected cost", { exact: true })
    .click();
  await page.getByLabel("Expected cost (CHF)").fill("100.05");
  await page.getByRole("button", { name: "Add booking", exact: true }).click();
  await expect(
    page.getByText(
      "Booking checked: 2026-09-05T08:00:00Z → 2026-09-05T17:00:00Z. Estimate 10005 centimes.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Booking name")).toHaveValue("Holiday flight");
});
test("clock ambiguity opens the relevant section and accepts an explicit occurrence", async ({
  page,
}) => {
  await page.goto("/m7-fixture/trips");
  await page.getByLabel("Booking name").fill("Late train");
  await page.getByText("Dates, times and places", { exact: true }).click();
  await page.getByLabel("Start (local date and time)").fill("2026-10-25T02:30");
  await page.getByText("Dates, times and places", { exact: true }).click();
  await page.getByRole("button", { name: "Add booking", exact: true }).click();
  await expect(page.getByLabel("Start (local date and time)")).toBeVisible();
  await expect(
    page.getByText(/This time is skipped or repeated/).first(),
  ).toBeVisible();
  await page
    .getByText("Does this time occur twice when clocks change?", {
      exact: true,
    })
    .click();
  await page
    .getByLabel("Start clock change", { exact: true })
    .selectOption("later");
  await page.getByRole("button", { name: "Add booking", exact: true }).click();
  await expect(
    page.getByText(
      "Booking checked: 2026-10-25T01:30:00Z → undated. Estimate none centimes.",
    ),
  ).toBeVisible();
});
test("booking details expose reference and safe reservation link with recoverable archive errors", async ({
  page,
}) => {
  await page.goto("/m7-fixture/trips?view=details");
  await expect(
    page.getByRole("heading", { name: "Zurich to New York" }),
  ).toBeVisible();
  await expect(page.getByText("LX14 · ABC123")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open booking" }),
  ).toHaveAttribute("href", "https://example.com/booking");
  await page.getByText("Remove from the itinerary", { exact: true }).click();
  await page
    .getByRole("button", { name: "Archive booking", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Partner changed this booking" }),
  ).toHaveText("Partner changed this booking. Reload before trying again.");
});
test("archived booking and archived trip have distinct recovery controls", async ({
  page,
}) => {
  await page.goto("/m7-fixture/trips?view=archived");
  await expect(
    page.getByRole("button", { name: "Restore booking" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit booking" })).toHaveCount(0);
  await page.goto("/m7-fixture/trips?view=archived-trip");
  await expect(
    page.getByText("Restore the trip to change this booking."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Archive booking|Restore booking/ }),
  ).toHaveCount(0);
});
test("the itinerary includes flights, stays, undated ideas and discoverable pagination", async ({
  page,
}) => {
  await page.goto("/m7-fixture/trips?view=itinerary");
  await expect(
    page.getByRole("heading", { name: "Itinerary & bookings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Zurich to New York", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Hotel in Manhattan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Museum afternoon", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View archived bookings" }),
  ).toHaveAttribute("href", /archivedBookings=1/);
  await expect(
    page
      .getByRole("navigation", { name: "Itinerary pages" })
      .getByRole("link", { name: "Next" }),
  ).toHaveAttribute("href", /bookingPage=2/);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((el) => el.clientWidth),
  );
});
