import { expect, type Page } from "@playwright/test";

export async function exerciseDeviceSignOut(
  alex: Page,
  sam: Page,
  tripUrl: string,
) {
  await sam.goto("/security");
  await sam
    .getByRole("button", { name: "Sign out of this device", exact: true })
    .click();
  await expect(sam).toHaveURL((url) => url.pathname === "/sign-in");
  const destination = new URL(tripUrl).pathname;
  await sam.goto(destination);
  await expect(sam).toHaveURL(
    (url) =>
      url.pathname === "/sign-in" &&
      url.searchParams.get("returnTo") === destination,
  );
  // The partner's independently authenticated session remains usable.
  await alex.goto(tripUrl);
  await expect(
    alex.getByRole("heading", { name: "CI holiday", exact: true, level: 1 }),
  ).toBeVisible();
}
