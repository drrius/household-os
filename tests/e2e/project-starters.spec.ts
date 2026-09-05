import { expect, test } from "@playwright/test";

test("selected packing tasks retain identities and recover from an uncertain response", async ({
  page,
}, info) => {
  await page.goto("/m7-fixture/starters");
  await page.getByLabel("Start with").selectOption("packing");
  await page
    .getByRole("checkbox", { name: "Pack a day bag and water bottle" })
    .uncheck();
  await page.getByRole("button", { name: "Add 4 tasks" }).click();
  await expect(
    page.getByRole("button", { name: "Adding tasks…" }),
  ).toBeDisabled();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("starter-response")),
  );
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Connection interrupted",
  );
  await expect(page.getByRole("main").getByRole("alert")).toBeFocused();
  await expect(
    page.getByRole("checkbox", { name: "Pack a day bag and water bottle" }),
  ).not.toBeChecked();
  await page.screenshot({
    path: info.outputPath("starter-checklist.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add 4 tasks" }).click();
  await expect(
    page.getByRole("button", { name: "Adding tasks…" }),
  ).toBeDisabled();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("starter-response")),
  );
  await expect(page.getByRole("status")).toHaveText(
    "3 tasks added. 1 already present.",
  );
  await expect(
    page.getByRole("link", { name: "Open checklist" }),
  ).toHaveAttribute(
    "href",
    "/plan/projects/22000200-0000-4000-8000-000000000001#tasks",
  );
});

test("home preparation is selectable and an empty selection cannot be submitted", async ({
  page,
}) => {
  await page.goto("/m7-fixture/starters");
  await page.getByLabel("Start with").selectOption("away");
  await expect(
    page.getByRole("checkbox", { name: "Arrange any pet and plant care" }),
  ).toBeChecked();
  for (const checkbox of await page.getByRole("checkbox").all())
    await checkbox.uncheck();
  await expect(
    page.getByRole("button", { name: "Add 0 tasks" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
});

test("uncertain operation survives reload and rotates after confirmation", async ({
  page,
}) => {
  await page.goto("/m7-fixture/starters");
  await page.getByLabel("Start with").selectOption("packing");
  const identity = await page.locator('[name="operationId"]').inputValue();
  await page.getByRole("button", { name: "Add 5 tasks" }).click();
  await expect(
    page.getByRole("button", { name: "Adding tasks…" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByLabel("Start with").selectOption("packing");
  await expect(page.locator('[name="operationId"]')).toHaveValue(identity);
  await page.getByRole("button", { name: "Add 5 tasks" }).click();
  await expect(
    page.getByRole("button", { name: "Adding tasks…" }),
  ).toBeDisabled();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("starter-response")),
  );
  await expect(page.getByRole("status")).toHaveText(
    "4 tasks added. 1 already present.",
  );
  await page.goto("/m7-fixture/starters");
  await expect(page.getByRole("button", { name: "Add 4 tasks" })).toBeEnabled();
  await expect(page.locator('[name="operationId"]')).not.toHaveValue(identity);
});

test("unavailable retry storage blocks submission with a recovery explanation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.goto("/m7-fixture/starters");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not keep retry information",
  );
  await expect(
    page.getByRole("button", { name: "Add 4 tasks" }),
  ).toBeDisabled();
});
