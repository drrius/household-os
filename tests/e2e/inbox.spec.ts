import { expect, test, type Page } from "@playwright/test";
async function holdNextSubmission(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  await page.route("**/m7-fixture/inbox**", async (route) => {
    if (!held && route.request().method() === "POST") {
      held = true;
      await gate;
    }
    await route.continue();
  });
  return release;
}

test("Inbox pages through equal timestamps and preserves unread navigation", async ({
  page,
}) => {
  await page.goto("/m7-fixture/inbox?filter=unread");
  await expect(
    page.getByRole("heading", { name: "Routine rescheduled", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Unread", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: /Routine rescheduled/ }),
  ).toHaveAttribute(
    "href",
    "/home/routines/11111111-1111-4111-8111-111111111111/edit",
  );
  await page.getByRole("link", { name: "Older messages", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Shopping finished", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Routine rescheduled", exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/filter=unread&cursor=/);
  await expect(
    page.getByRole("link", { name: "Latest messages", exact: true }),
  ).toHaveAttribute("href", "/m7-fixture/inbox?filter=unread");
  await page.getByRole("link", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/filter=all$/);
  await expect(
    page.getByRole("heading", { name: "Routine rescheduled", exact: true }),
  ).toBeVisible();
});
test("marking a page settles errors and changes only its visible unread messages", async ({
  page,
}) => {
  await page.goto("/m7-fixture/inbox");
  const pageButton = page.getByRole("button", {
    name: "Mark this page read",
    exact: true,
  });
  await expect(
    page.getByRole("button", { name: "Mark all read", exact: true }),
  ).toHaveCount(0);
  const release = await holdNextSubmission(page);
  const submit = pageButton.click();
  await expect(pageButton).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Mark this page read", exact: true }),
  ).toHaveText("Marking read…");
  release();
  await submit;
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Couldn't mark these messages read. Please try again.",
  );
  await expect(pageButton).toBeEnabled();
  await pageButton.click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Messages marked read.",
  );
  await expect(
    page.getByRole("main").getByText("4 unread", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark read", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Older messages", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark read", exact: true }),
  ).toHaveCount(2);
});
test("single-message recovery preserves the older unread view", async ({
  page,
}) => {
  await page.goto("/m7-fixture/inbox?filter=unread");
  await page.getByRole("link", { name: "Older messages", exact: true }).click();
  const row = page.getByRole("listitem").filter({
    has: page.getByRole("heading", {
      name: "Shopping finished",
      exact: true,
    }),
  });
  const release = await holdNextSubmission(page);
  const submit = row
    .getByRole("button", { name: "Mark read", exact: true })
    .click();
  await expect(
    row.getByRole("button", { name: "Mark read", exact: true }),
  ).toBeDisabled();
  release();
  await submit;
  await expect(row.getByRole("alert")).toContainText("Please try again");
  await row.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(page).toHaveURL(/filter=unread&cursor=.+&saved=read/);
  await expect(
    page.getByRole("heading", { name: "Shopping finished", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Routine updated", exact: true }),
  ).toBeVisible();
});
test("caught-up, first-use and invalid saved positions have clear recovery", async ({
  page,
}) => {
  await page.goto("/m7-fixture/inbox?filter=unread&state=caught-up");
  await expect(
    page.getByRole("heading", { name: "You're caught up", exact: true }),
  ).toBeVisible();
  await page.goto("/m7-fixture/inbox?state=empty");
  await expect(
    page.getByRole("heading", { name: "Nothing here yet", exact: true }),
  ).toBeVisible();
  await page.goto("/m7-fixture/inbox?cursor=invalid");
  await expect(
    page.getByText("This saved inbox position is no longer valid."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open the latest messages" }),
  ).toHaveAttribute("href", "/home/inbox");
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);
});
