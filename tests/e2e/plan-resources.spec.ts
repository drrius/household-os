import { expect, test } from "@playwright/test";
const project = "f0000000-0000-4000-8000-000000000001";
const booking = "f0000000-0000-4000-8000-000000000011";
test("booking resources expose real paid totals, scoped expense actions and document navigation", async ({
  page,
}) => {
  await page.goto("/m7-fixture/plan-resources");
  const costs = page.getByRole("region", { name: "Paid expenses" });
  await expect(costs).toContainText("CHF 75.00");
  await expect(costs).toContainText("after refunds and corrections");
  await expect(
    costs.getByRole("link", { name: "Add paid expense", exact: true }),
  ).toHaveAttribute(
    "href",
    `/money/contexts/project/${project}/new?booking=${booking}`,
  );
  const create = new URL(
    (await page
      .getByRole("link", { name: "Add document", exact: true })
      .getAttribute("href")) ?? "",
    "https://household.test",
  );
  expect(create.searchParams.get("project")).toBe(project);
  expect(create.searchParams.get("booking")).toBe(booking);
  expect(create.searchParams.get("back")).toContain(`/bookings/${booking}`);
  const next = new URL(
    (await page
      .getByRole("link", { name: "More documents" })
      .getAttribute("href")) ?? "",
    "https://household.test",
  );
  expect(next.searchParams.get("documentPage")).toBe("1");
  expect(next.searchParams.get("back")).toContain("taskPage=2");
  await page.getByRole("link", { name: "Hotel confirmation" }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=.*documents/);
  await page.goto("/m7-fixture/plan-resources?archived=1");
  await expect(
    page.getByRole("link", { name: "Add document", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Add paid expense", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "View paid expenses" }),
  ).toBeVisible();
});
test("a confirmation retains its booking through save and edit and cannot select another trip's booking", async ({
  page,
}) => {
  const path = `f1000000-0000-4000-8000-000000000001/documents/${booking}.pdf`;
  await page.route("**/api/attachments", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ path }),
    }),
  );
  await page.goto(
    `/m7-fixture/home-records/documents?project=${project}&booking=${booking}`,
  );
  await expect(page.getByLabel("Trip or project")).toHaveValue(project);
  await expect(page.getByLabel("Booking", { exact: false })).toHaveValue(
    booking,
  );
  await expect(
    page
      .getByLabel("Booking")
      .locator("option")
      .filter({ hasText: "Summer flight" }),
  ).toHaveCount(0);
  await page.getByLabel("Document name").fill("Our hotel confirmation");
  await page
    .getByLabel("File", { exact: true })
    .setInputFiles({
      name: "confirmation.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nfixture"),
    });
  await expect(page.getByText("Attachment ready.")).toBeVisible();
  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Weekend hotel", exact: true }),
  ).toHaveAttribute("href", `/plan/projects/${project}/bookings/${booking}`);
  await page.getByRole("link", { name: "Edit details" }).click();
  await expect(page.getByLabel("Booking")).toHaveValue(booking);
  await page
    .getByLabel("Trip or project")
    .selectOption({ label: "Summer trip" });
  await expect(page.getByLabel("Booking")).toHaveValue("");
  await expect(
    page
      .getByLabel("Booking")
      .locator("option")
      .filter({ hasText: "Weekend hotel" }),
  ).toHaveCount(0);
  await page.getByLabel("Inventory item").selectOption({ label: "Dishwasher" });
  await expect(page.getByLabel("Trip or project")).toHaveValue("");
  await expect(page.getByLabel("Booking")).toBeDisabled();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("link", { name: "Search household", exact: true })
    .click();
  await expect(page.getByLabel("Document name")).toHaveValue(
    "Our hotel confirmation",
  );
});
