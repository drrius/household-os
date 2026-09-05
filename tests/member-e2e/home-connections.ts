import { expect, type Page } from "@playwright/test";
import { Temporal } from "@js-temporal/polyfill";

const heading = (page: Page, name: string) =>
  page.getByRole("heading", { name, exact: true, level: 1 });
const dateLabel = (date: string) =>
  Temporal.PlainDate.from(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

async function exerciseInventory(alex: Page, sam: Page) {
  await alex.goto("/home/contacts/new");
  await alex.getByLabel("Name", { exact: true }).fill("CI repair contact");
  await alex.getByRole("button", { name: "Add contact", exact: true }).click();
  await expect(heading(alex, "CI repair contact")).toBeVisible();
  const contactPath = new URL(alex.url()).pathname;

  await alex.goto("/home/inventory/new");
  await alex.getByLabel("Item", { exact: true }).fill("CI dishwasher");
  const warranty = Temporal.Now.plainDateISO("Europe/Zurich")
    .add({ years: 1 })
    .toString();
  await alex.getByLabel(/^Warranty ends/).fill(warranty);
  await alex.getByLabel(/^Repair or supplier contact/).selectOption({
    label: "CI repair contact",
  });
  await alex.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(heading(alex, "CI dishwasher")).toBeVisible();
  const inventoryUrl = alex.url();
  await alex
    .locator("summary")
    .filter({ hasText: /^Add maintenance record$/ })
    .click();
  await alex
    .getByLabel("Work carried out", { exact: true })
    .fill("CI filter cleaned");
  await alex
    .getByRole("button", { name: "Add maintenance record", exact: true })
    .click();
  await expect(
    alex.getByRole("heading", { name: "CI filter cleaned", exact: true }),
  ).toBeVisible();

  await sam.goto(inventoryUrl);
  const warrantyDate = sam
    .getByRole("region", { name: "CI dishwasher", exact: true })
    .getByText("Warranty ends", { exact: true })
    .locator("..")
    .locator("time");
  await expect(warrantyDate).toHaveAttribute("datetime", warranty);
  await expect(warrantyDate).toHaveText(dateLabel(warranty));
  await expect(
    sam.getByRole("heading", { name: "CI filter cleaned", exact: true }),
  ).toBeVisible();
  await sam
    .getByRole("link", { name: "CI repair contact", exact: true })
    .click();
  await expect(sam).toHaveURL((url) => url.pathname === contactPath);
  await expect(heading(sam, "CI repair contact")).toBeVisible();
  return inventoryUrl;
}

async function exerciseRenewal(alex: Page, sam: Page) {
  const today = Temporal.Now.plainDateISO("Europe/Zurich");
  await alex.goto("/home/commitments/new");
  await alex
    .getByLabel("Commitment", { exact: true })
    .fill("CI home insurance");
  await alex
    .getByLabel(/^Who keeps an eye on it/)
    .selectOption({ label: "Sam" });
  await alex
    .getByLabel(/^Next renewal/)
    .fill(today.add({ days: 1 }).toString());
  await alex.getByLabel("Notice period in days", { exact: true }).fill("1");
  await alex.getByLabel(/^Expected cost \(CHF\)/).fill("120.00");
  await alex
    .getByRole("button", { name: "Add commitment", exact: true })
    .click();
  await expect(heading(alex, "CI home insurance")).toBeVisible();
  const commitmentPath = new URL(alex.url()).pathname;

  await sam.goto("/");
  await sam.getByRole("link", { name: /CI home insurance/ }).click();
  await expect(sam).toHaveURL((url) => url.pathname === commitmentPath);
  await expect(
    sam.getByRole("heading", {
      name: `Decide before ${dateLabel(today.toString())}`,
    }),
  ).toBeVisible();
  await sam.goto("/money");
  // A renewal's expected cost must not create a financial obligation.
  await expect(
    sam.getByRole("region", { name: "You owe Alex", exact: true }),
  ).toContainText("50.00");
}

async function exerciseDecision(alex: Page, sam: Page) {
  await alex.goto("/home/decisions/new");
  await alex
    .getByLabel("What are you considering?", { exact: true })
    .fill("CI balcony garden");
  await alex.getByRole("button", { name: "Add decision", exact: true }).click();
  await expect(heading(alex, "CI balcony garden")).toBeVisible();
  const decisionUrl = alex.url();
  await alex
    .getByRole("button", { name: "Make it a project", exact: true })
    .click();
  await expect(alex).toHaveURL(/\/plan\/projects\/[0-9a-f-]+\?saved=1$/);
  await expect(heading(alex, "CI balcony garden")).toBeVisible();
  const projectPath = new URL(alex.url()).pathname;
  await sam.goto(decisionUrl);
  await expect(
    sam.getByRole("button", { name: "Make it a project", exact: true }),
  ).toHaveCount(0);
  await sam
    .getByRole("link", { name: "Open the plan you created →", exact: true })
    .click();
  await expect(sam).toHaveURL((url) => url.pathname === projectPath);
  await expect(heading(sam, "CI balcony garden")).toBeVisible();
}

export async function exerciseHomeConnections(alex: Page, sam: Page) {
  const inventoryUrl = await exerciseInventory(alex, sam);
  await exerciseRenewal(alex, sam);
  await exerciseDecision(alex, sam);
  return { inventoryUrl };
}
