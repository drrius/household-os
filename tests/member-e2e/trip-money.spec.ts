import { expect, test, type Page } from "@playwright/test";
import { bootstrapMembers } from "./local-runtime";

async function enroll(page: Page, link: string) {
  try {
    await page.goto(link);
  } catch {
    throw new Error("Member enrollment navigation failed.");
  }
  await page.getByRole("button", { name: "Continue to passkey setup" }).click();
  await expect(page).toHaveURL(/\/security$/);
}

async function createTripAndBooking(page: Page) {
  await page.goto("/plan/trips/new");
  await page.getByLabel("Trip name", { exact: true }).fill("CI holiday");
  await page.getByLabel("Destination", { exact: true }).fill("Lisbon");
  await page.getByRole("button", { name: "Create trip", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "CI holiday", exact: true }),
  ).toBeVisible();
  const tripUrl = page.url();
  await page.getByRole("link", { name: "Add booking", exact: true }).click();
  await page
    .getByLabel("Booking name", { exact: true })
    .fill("CI outbound flight");
  await page.getByRole("button", { name: "Add booking", exact: true }).click();
  await page.goto(tripUrl);
  await page.getByRole("link", { name: /CI outbound flight/ }).click();
  await expect(
    page.getByRole("heading", { name: "CI outbound flight", exact: true }),
  ).toBeVisible();
  return tripUrl;
}

test("two members share a persisted trip, booking and authoritative paid expense", async ({
  browser,
  baseURL,
}) => {
  const links = await bootstrapMembers(baseURL!);
  const memberA = await browser.newContext({ baseURL });
  const memberB = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  try {
    const alex = await memberA.newPage();
    const sam = await memberB.newPage();
    await enroll(alex, links[0]!);
    await enroll(sam, links[1]!);
    await alex.goto("/money");
    await expect(
      alex.getByRole("heading", { name: "Settled up" }),
    ).toBeVisible();
    const tripUrl = await createTripAndBooking(alex);
    await alex
      .getByRole("link", { name: "Add paid expense", exact: true })
      .click();
    await alex
      .getByLabel("Description", { exact: true })
      .fill("CI paid flight");
    await alex.getByLabel("Amount in CHF", { exact: true }).fill("82.10");
    await alex
      .getByRole("button", { name: "Post expense", exact: true })
      .click();
    await expect(
      alex.getByRole("heading", { name: "Add paid expense", exact: true }),
    ).toHaveCount(0);
    await sam.goto(tripUrl);
    await expect(
      sam.getByRole("heading", { name: "CI holiday", exact: true }),
    ).toBeVisible();
    await expect(
      sam.getByRole("link", { name: /CI outbound flight/ }),
    ).toBeVisible();
    await expect(
      sam.getByRole("region", { name: "Paid expenses", exact: true }),
    ).toContainText("CHF 82.10");
    await sam.goto("/money");
    await expect(
      sam.getByRole("heading", { name: "You owe Alex", exact: true }),
    ).toBeVisible();
    await expect(
      sam.getByRole("region", { name: "You owe Alex", exact: true }),
    ).toContainText("41.05");
    await sam.getByRole("link", { name: /CI paid flight/ }).click();
    await expect(
      sam.getByRole("heading", { name: "CI paid flight", exact: true }),
    ).toBeVisible();
  } finally {
    await memberA.close();
    await memberB.close();
  }
});
