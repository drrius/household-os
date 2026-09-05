export const PRODUCT_DESTINATIONS = [
  { id: "today", href: "/", label: "Today" },
  { id: "plan", href: "/plan", label: "Plan" },
  { id: "groceries", href: "/groceries", label: "Groceries" },
  { id: "money", href: "/money", label: "Money" },
  { id: "home", href: "/home", label: "Home" },
] as const;

export type ProductDestinationId = (typeof PRODUCT_DESTINATIONS)[number]["id"];

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
  {
    id: "trip",
    href: "/plan/trips/new",
    label: "Trip",
    description: "A getaway, bookings and plans together",
  },
  {
    id: "project",
    href: "/plan/projects/new",
    label: "Project",
    description: "A shared goal and its next steps",
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
  /^\/home\/occurrences\/[^/]+$/,
  /^\/home\/notifications$/,
] as const;

export function isFormSurface(pathname: string): boolean {
  return FORM_SURFACE_PATTERNS.some((pattern) => pattern.test(pathname));
}
