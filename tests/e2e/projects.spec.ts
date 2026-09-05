import { expect, test } from "@playwright/test";

test("trip dates validate without losing the destination or notes", async ({
  page,
}) => {
  await page.goto("/m7-fixture/projects");
  await page
    .getByRole("textbox", { name: "Trip name", exact: true })
    .fill("Copenhagen together");
  await page.getByRole("textbox", { name: "Destination" }).fill("Copenhagen");
  await page.getByLabel("Start date").fill("2026-10-08");
  await page.getByLabel("End date").fill("2026-10-07");
  await page
    .getByRole("textbox", { name: "Notes" })
    .fill("Book somewhere near the canals");
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect(
    page
      .getByText("The end date must be on or after the start date.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Destination" })).toHaveValue(
    "Copenhagen",
  );
  await page.getByLabel("End date").fill("2026-10-12");
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect(
    page.getByText("Connection interrupted. Your details are still here.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Notes" })).toHaveValue(
    "Book somewhere near the canals",
  );
});

test("archived trip browsing retains its archive context and fits phones", async ({
  page,
}, info) => {
  await page.goto("/m7-fixture/projects?view=list");
  await expect(page.getByRole("link", { name: "More plans" })).toHaveAttribute(
    "href",
    "/plan/trips?page=2&archived=1",
  );
  await expect(page.getByRole("link", { name: "Previous" })).toHaveAttribute(
    "href",
    "/plan/trips?page=0&archived=1",
  );
  await expect(
    page.getByRole("heading", { name: "A long weekend in Copenhagen" }),
  ).toBeVisible();
  const fits = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth + 1,
  );
  expect(fits).toBe(true);
  await page.screenshot({ path: info.outputPath("trips.png"), fullPage: true });
});

test("a rejected checklist completion remains visible and recoverable", async ({
  page,
}) => {
  await page.goto("/m7-fixture/projects?view=task");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "This task changed. Reload before trying again.",
  );
  await expect(
    page.getByRole("link", { name: "Pack the chargers" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Done", exact: true }),
  ).toBeEnabled();
});

for (const kind of ["project", "task"]) {
  test(`${kind} edits keep their original version after a partner refresh`, async ({
    page,
  }) => {
    await page.goto(`/m7-fixture/projects?view=concurrent-${kind}`);
    const title = page.getByRole("textbox", {
      name: kind === "project" ? "Trip name" : "What needs doing?",
      exact: true,
    });
    await title.fill("My unsaved change");
    await page
      .getByRole("button", { name: "Simulate partner refresh" })
      .click();
    await expect(title).toHaveValue("My unsaved change");
    await page
      .getByRole("button", {
        name: kind === "project" ? "Save changes" : "Save task",
        exact: true,
      })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "This changed since you opened it",
    );
    await expect(title).toHaveValue("My unsaved change");
  });
}
