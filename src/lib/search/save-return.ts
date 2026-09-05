import { searchReturnHref } from "./return-context";

export function withSearchReturn(destination: string, form: FormData): string {
  const values = form.getAll("searchReturn");
  const href = values.length === 1 ? searchReturnHref(values[0]) : null;
  if (!href) return destination;
  const url = new URL(destination, "https://household.invalid");
  if (
    !destination.startsWith("/") ||
    url.origin !== "https://household.invalid"
  )
    throw new Error("Invalid save destination.");
  url.searchParams.set("fromSearch", href);
  return `${url.pathname}${url.search}${url.hash}`;
}
