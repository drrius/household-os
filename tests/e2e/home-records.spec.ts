import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("household-os:welcome-dismissed", "1"),
  );
});
test("inventory retains invalid warranty input, then saves, edits, archives and restores", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-records/inventory");
  await page.getByLabel("Item", { exact: true }).fill("Dishwasher");
  await page.getByLabel("Purchased on").fill("2026-09-05");
  await page.getByLabel("Warranty ends").fill("2026-09-04");
  const id = await page.locator('input[name="id"]').inputValue();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(
    page.getByText("Warranty must end on or after purchase."),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator('input[name="id"]')).toHaveValue(id);
  await expect(page.getByLabel("Item", { exact: true })).toHaveValue(
    "Dishwasher",
  );
  await page.getByLabel("Warranty ends").fill("2028-09-05");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dishwasher", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit details" }).click();
  await page.getByLabel("Brand & model").fill("Model 42");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Model 42", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(
    page.getByText("Archived record", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Current record", { exact: true })).toBeVisible();
});
test("commitments show notice deadline, responsibility and a separate expected cost", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-records/commitments");
  await page.getByLabel("Commitment", { exact: true }).fill("Internet");
  await page
    .getByLabel("Who keeps an eye on it")
    .selectOption({ label: "Partner" });
  await page.getByLabel("Next renewal").fill("2027-01-01");
  await page.getByLabel("Notice period in days").fill("31");
  await page.getByLabel("Expected cost (CHF)").fill("1234.50");
  await page
    .getByRole("button", { name: "Add commitment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Decide before 1 Dec 2026" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("CHF 1234.50", { exact: true })).toBeVisible();
  await expect(page.getByText("Partner", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Expected costs are planning information/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit details" }).click();
  await page
    .getByLabel("Status", { exact: true })
    .selectOption("cancel_requested");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Check cancellation before renewal" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Decide before/ }),
  ).toHaveCount(0);
});
test("documents use a required private upload and retain its attachment", async ({
  page,
}) => {
  const path =
    "f1000000-0000-4000-8000-000000000001/documents/f0000000-0000-4000-8000-000000000001.pdf";
  await page.route("**/api/attachments", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ path }),
    }),
  );
  await page.goto("/m7-fixture/home-records/documents");
  await page.getByLabel("Document name").fill("Dishwasher manual");
  await page.getByLabel("File", { exact: true }).setInputFiles({
    name: "manual.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nfixture"),
  });
  await expect(page.getByText("Attachment ready.")).toBeVisible();
  await page.getByLabel("Inventory item").selectOption({ label: "Dishwasher" });
  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open private file" }),
  ).toHaveAttribute(
    "href",
    `/api/attachments?path=${encodeURIComponent(path)}`,
  );
  await expect(
    page.getByRole("link", { name: "Dishwasher", exact: true }),
  ).toBeVisible();
});
for (const [kind, label, value, button] of [
  ["contacts", "Name", "Repair workshop", "Add contact"],
  ["decisions", "What are you considering?", "A weekend away", "Add decision"],
  ["options", "Option", "Travel by train", "Add option"],
  [
    "maintenance",
    "Work carried out",
    "Replaced filter",
    "Add maintenance record",
  ],
] as const)
  test(`${kind} save useful details and stay within a phone viewport`, async ({
    page,
  }) => {
    await page.goto(`/m7-fixture/home-records/${kind}`);
    await page.getByLabel(label, { exact: true }).fill(value);
    if (kind === "maintenance")
      await page.getByLabel("Performed on").fill("2026-09-05");
    if (kind === "options")
      await page.getByLabel("Estimated cost (CHF)").fill("85.25");
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: value, exact: true }),
    ).toBeVisible({ timeout: 15000 });
    const width = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(width.content).toBeLessThanOrEqual(width.viewport + 1);
  });

test("editing an archived fixture preserves archive state and details", async ({
  page,
}) => {
  await page.goto("/m7-fixture/home-records/inventory");
  await page.getByLabel("Item", { exact: true }).fill("Archived dishwasher");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("link", { name: "Edit details" }).click();
  await page.getByLabel("Brand & model").fill("Model after archive");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Archived record", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Model after archive", { exact: true }),
  ).toBeVisible();
});
