import { expect, test } from "@playwright/test";

async function expectHealthyFormPage(page: import("@playwright/test").Page) {
  await expect(page).toHaveTitle(/Household OS/);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(
    page.locator("nextjs-portal [data-next-badge][data-error='true']"),
  ).toHaveCount(0);
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

test("routine form exposes the complete M7 scheduling contract", async ({
  page,
}) => {
  await page.goto("/m7-fixture/routine");
  await expectHealthyFormPage(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "New routine" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Assignment" })
    .selectOption("alternating");

  // Only the fields for the selected repeat mode are rendered.
  await expect(page.locator('input[name="oneOffDate"]')).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: "Monday" })).toHaveCount(0);

  await page.getByRole("combobox", { name: "Repeat" }).selectOption("weekdays");
  await page.getByRole("checkbox", { name: "Monday" }).check();
  await page.getByRole("checkbox", { name: "Friday" }).check();
  await expect(page.getByRole("checkbox", { name: "Monday" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Friday" })).toBeChecked();
  await expect(page.locator('input[name="oneOffDate"]')).toHaveCount(0);
});

test("expense form supports payer selection and exact centime allocations", async ({
  page,
}) => {
  await page.goto("/m7-fixture/expense");
  await expectHealthyFormPage(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "New expense" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Payer" })
    .selectOption({ label: "Partner" });

  // Exact shares stay hidden until the exact allocation is chosen.
  await expect(page.getByRole("textbox", { name: /exact share/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("combobox", { name: "Allocation" })
    .selectOption("exact");
  await expect(page.getByRole("textbox", { name: /exact share/ })).toHaveCount(
    2,
  );
  await page
    .getByRole("textbox", { name: /Darius's exact share/ })
    .fill("7.00");
  await page
    .getByRole("textbox", { name: /Partner's exact share/ })
    .fill("3.00");
  await expect(
    page.getByRole("textbox", { name: /Darius's exact share/ }),
  ).toHaveValue("7.00");
  await expect(
    page.getByRole("textbox", { name: /Partner's exact share/ }),
  ).toHaveValue("3.00");
});
