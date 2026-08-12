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
] as const;
