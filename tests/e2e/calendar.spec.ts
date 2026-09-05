import { expect, test } from "@playwright/test";
test("calendar agenda makes daily additions and recurring edits discoverable", async ({
  page,
}, testInfo) => {
  await page.goto("/m7-fixture/calendar?surface=agenda");
  await expect(
    page.getByRole("heading", { name: "Our calendar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Dinner at our favourite place/ }),
  ).toHaveAttribute("href", /occurrence=/);
  await expect(
    page.getByRole("link", { name: "Add event on 2026-09-07" }),
  ).toHaveAttribute("href", "/plan/calendar/new?date=2026-09-07");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("calendar-agenda.png"),
    fullPage: true,
  });
});
test("all-day event preserves entered dates through a recoverable validation failure", async ({
  page,
}, testInfo) => {
  await page.goto("/m7-fixture/calendar");
  await page.getByLabel("Title", { exact: true }).fill("Weekend by the lake");
  await page.getByLabel("All day", { exact: true }).check();
  await page.getByLabel("First day", { exact: true }).fill("2026-09-12");
  await page.getByLabel("Last day", { exact: true }).fill("2026-09-11");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't save" }),
  ).toContainText("end date cannot be before");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Weekend by the lake",
  );
  await expect(page.getByLabel("First day", { exact: true })).toHaveValue(
    "2026-09-12",
  );
  await page.getByLabel("Last day", { exact: true }).fill("2026-09-13");
  await page.screenshot({
    path: testInfo.outputPath("calendar-editor.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Plan saved" })).toBeVisible();
  await expect(
    page.getByText("Weekend by the lake", { exact: true }),
  ).toBeVisible();
});
test("iCloud setup honestly requires encryption before collecting credentials", async ({
  page,
}) => {
  await page.goto("/m7-fixture/calendar?surface=setup");
  await expect(
    page.getByRole("heading", { name: "One server setup step" }),
  ).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(
    page.getByText("HOUSEHOLD_CALENDAR_ENCRYPTION_KEY", { exact: true }),
  ).toBeVisible();
});

test("initially all-day event stays timed after a rejected submission", async ({
  page,
}) => {
  await page.goto("/m7-fixture/calendar?surface=initial-all-day");
  await expect(page.getByLabel("All day", { exact: true })).toBeChecked();
  await page.getByLabel("Title", { exact: true }).fill("Timed plan");
  await page.getByLabel("All day", { exact: true }).uncheck();
  await page.getByLabel("Starts", { exact: true }).fill("2026-09-07T11:00");
  await page.getByLabel("Ends", { exact: true }).fill("2026-09-07T10:00");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't save" }),
  ).toBeVisible();
  await expect(page.getByLabel("All day", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("Starts", { exact: true })).toHaveValue(
    "2026-09-07T11:00",
  );
  await expect(page.getByLabel("Ends", { exact: true })).toHaveValue(
    "2026-09-07T10:00",
  );
  await page.getByLabel("Ends", { exact: true }).fill("2026-09-07T12:00");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Plan saved" })).toBeVisible();
});
test("agenda omits a previous-week midnight ending and shows this week's midnight ending once", async ({
  page,
}) => {
  await page.goto("/m7-fixture/calendar?surface=agenda");
  await expect(
    page.getByRole("link", { name: /Sunday night train/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Monday night train/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Connect iCloud" }),
  ).toHaveAttribute("href", "/home/calendar");
});
