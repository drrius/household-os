export const PRODUCT_DESTINATIONS = [
  { id: "today", href: "/", label: "Today" },
  { id: "plan", href: "/plan", label: "Plan" },
  { id: "groceries", href: "/groceries", label: "Groceries" },
  { id: "money", href: "/money", label: "Money" },
  { id: "home", href: "/home", label: "Home" },
] as const;

export type ProductDestinationId = (typeof PRODUCT_DESTINATIONS)[number]["id"];

/**
 * The plan board opens on one day, so every route back to it names that day
 * instead of dropping the member into the current week.
 */
export function planDayHref(date: string): string {
  return `/plan?date=${encodeURIComponent(date)}`;
}

export const GLOBAL_ADD_OPTIONS = [
  {
    id: "routine",
    href: "/home/routines/new",
    label: "Routine",
    description: "One-off or recurring · assigned, alternating or shared",
  },
  {
    id: "grocery",
    href: "/groceries/new",
    label: "Grocery item",
    description: "Straight onto the shared list",
  },
  {
    id: "meal",
    href: "/plan/meals/new",
    label: "Meal",
    description: "Into a day on the week board",
  },
  {
    id: "expense",
    href: "/money/expenses/new",
    label: "Expense",
    description: "CHF · 50/50 or exact split · counts right away",
  },
] as const;

// Dedicated create and edit surfaces already are the add flow. Not every one of
// them ends in `/new` or `/edit`, so the named surfaces are listed alongside the
// suffix pattern rather than inferred from it.
const FORM_SURFACE_PATTERNS = [
  /\/(?:new|edit)$/,
  /^\/plan\/meals\/[^/]+$/,
  /^\/money\/opening-balance$/,
  /^\/home\/setup$/,
  /^\/home\/notifications$/,
] as const;

export function isFormSurface(pathname: string): boolean {
  return FORM_SURFACE_PATTERNS.some((pattern) => pattern.test(pathname));
}
