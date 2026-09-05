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

test("reloading after an uncertain batch preserves receipt identities", async ({
  page,
}) => {
  await page.goto("/m7-fixture/starters");
  await page.getByLabel("Start with").selectOption("packing");
  const identities = await page
    .locator('input[name^="id:"]')
    .evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
  await page.getByRole("button", { name: "Add 5 tasks" }).click();
  await expect(
    page.getByRole("button", { name: "Adding tasks…" }),
  ).toBeDisabled();
  // The fixture stores its committed receipt before delivering any response.
  await page.reload();
  await page.getByLabel("Start with").selectOption("packing");
  expect(
    await page
      .locator('input[name^="id:"]')
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      ),
  ).toEqual(identities);
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
});
