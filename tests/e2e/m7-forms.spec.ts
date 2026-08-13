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

async function chooseOption(
  page: import("@playwright/test").Page,
  name: string,
  option: string,
) {
  await page.getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option }).click();
}

test("routine form exposes the complete M7 scheduling contract", async ({
  page,
}) => {
  await page.goto("/m7-fixture/routine");
  await expectHealthyFormPage(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "New routine" }),
  ).toBeVisible();
  await chooseOption(page, "Assignment", "Alternating");

  await expect(page.locator('input[name="oneOffDate"]')).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: "Monday" })).toHaveCount(0);

  await chooseOption(page, "Repeat", "Selected weekdays");
  await page.getByRole("textbox", { name: "Title" }).fill("Walk the dog");
  await page.getByRole("button", { name: "Create routine" }).click();
  await expect(page.getByText("Choose at least one weekday.")).toBeVisible();
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
  await chooseOption(page, "Payer", "Partner");

  await expect(page.getByRole("textbox", { name: / pays$/ })).toHaveCount(0);
  await chooseOption(page, "How to split it", "Different amounts each");
  await expect(page.getByRole("textbox", { name: / pays$/ })).toHaveCount(2);
  await page.getByRole("textbox", { name: "Darius pays" }).fill("7.00");
  await page.getByRole("textbox", { name: "Partner pays" }).fill("3.00");
  await expect(page.getByRole("textbox", { name: "Darius pays" })).toHaveValue(
    "7.00",
  );
  await expect(page.getByRole("textbox", { name: "Partner pays" })).toHaveValue(
    "3.00",
  );
});
