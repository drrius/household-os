import { expect, test } from "@playwright/test";
const id = "00000000-0000-4000-8000-000000000001";
test("recorded expense selection preserves booking scope and exact paid amounts", async ({
  page,
}) => {
  await page.goto("/m7-fixture/associations");
  await expect(
    page.getByRole("heading", { name: "Choose a recorded expense" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Zurich flight/ })).toContainText(
    "125.01",
  );
  await expect(
    page.getByRole("link", { name: /Zurich flight/ }),
  ).toHaveAttribute(
    "href",
    `/money/contexts/project/${id}/existing/${id}?booking=${id}`,
  );
  const next = page.getByRole("link", { name: "Earlier expenses" });
  await expect(next).toHaveAttribute(
    "href",
    `/money/contexts/project/${id}/existing?booking=${id}&beforeOn=2026-09-05&beforeId=${id}`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.goto("/m7-fixture/associations?mode=empty");
  await expect(page.getByText(/No recorded expenses yet/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Earlier expenses" }),
  ).toHaveCount(0);
});
test("confirmation freezes visible choice, revision and retry identity through refresh and rejection", async ({
  page,
}) => {
  await page.goto("/m7-fixture/associations?mode=confirm");
  const request = await page.locator('input[name="requestId"]').inputValue();
  await expect(
    page.getByText("Current association: Summer holiday"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(page.getByText("Server changed", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Current association: Summer holiday"),
  ).toBeVisible();
  await expect(page.locator('input[name="expectedRevision"]')).toHaveValue(id);
  await page.getByRole("button", { name: "Save association" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    `Original revision: ${id}`,
  );
  await expect(page.locator('input[name="requestId"]')).toHaveValue(request);
  await expect(page.locator('input[name="expectedRevision"]')).toHaveValue(id);
  await expect(
    page.getByText("Current association: Summer holiday"),
  ).toBeVisible();
});
test("removal explains corrected-payment inheritance and successful action returns visibly", async ({
  page,
}) => {
  await page.goto("/m7-fixture/associations?mode=remove&outcome=success");
  await expect(
    page.getByText(/Removing an override restores that inherited context/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove association" }).click();
  await expect(
    page.getByRole("heading", { name: "Association request saved" }),
  ).toBeVisible();
  await expect(page.getByText("No new payment recorded.")).toBeVisible();
});
