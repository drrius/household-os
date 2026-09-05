import { expect, test, type Page } from "@playwright/test";
import { bootstrapMembers } from "./local-runtime";

async function enroll(page: Page, link: string) {
  try {
    await page.goto(link);
    await page
      .getByRole("button", { name: "Continue to passkey setup" })
      .click();
    await page.waitForURL((url) => url.pathname === "/security");
  } catch {
    throw new Error(
      "Member enrollment failed; token-bearing URLs are omitted.",
    );
  }
}

async function enterHousehold(page: Page) {
  await page.goto("/");
  const welcome = page.getByRole("dialog", {
    name: "Welcome to your household",
  });
  await welcome
    .getByRole("button", { name: "Explore first", exact: true })
    .click();
  await expect(welcome).toBeHidden();
}

async function createTripAndBooking(page: Page) {
  await page.goto("/plan/trips/new");
  await page.getByLabel("Trip name", { exact: true }).fill("CI holiday");
  await page.getByLabel(/^Destination/).fill("Lisbon");
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
  for (const context of [memberA, memberB]) {
    context.setDefaultTimeout(20_000);
    context.setDefaultNavigationTimeout(60_000);
  }
  try {
    const alex = await memberA.newPage();
    const sam = await memberB.newPage();
    await enroll(alex, links[0]!);
    await enroll(sam, links[1]!);
    await enterHousehold(alex);
    await enterHousehold(sam);
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
  } catch (error) {
    const page = memberA.pages()[0];
    if (page && !new URL(page.url()).pathname.startsWith("/auth")) {
      const snapshot = await page
        .locator("body")
        .ariaSnapshot()
        .catch(() => "Unavailable");
      console.info("Member A failure state:", snapshot.slice(0, 12000));
    }
    throw error;
  } finally {
    await Promise.all([
      memberA.close().catch(() => {}),
      memberB.close().catch(() => {}),
    ]);
  }
});
