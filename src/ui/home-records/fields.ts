import type { RecordKind } from "@/domain/home-records/schema";
export type RecordField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "date"
    | "email"
    | "url"
    | "tel"
    | "number"
    | "money"
    | "textarea"
    | "select"
    | "attachment";
  required?: boolean;
  max?: number;
  choices?: readonly string[];
  initial?: string;
};
export const fields: Record<RecordKind, RecordField[]> = {
  inventory: [
    { name: "title", label: "Item", required: true, max: 160 },
    { name: "category", label: "Category", initial: "Home", max: 80 },
    { name: "purchased_on", label: "Purchased on", type: "date" },
    { name: "warranty_until", label: "Warranty ends", type: "date" },
    { name: "model", label: "Brand & model", max: 200 },
    { name: "serial_number", label: "Serial number", max: 200 },
    { name: "contact_id", label: "Repair or supplier contact", type: "select" },
    {
      name: "notes",
      label: "Care instructions & notes",
      type: "textarea",
      max: 8000,
    },
  ],
  contacts: [
    { name: "name", label: "Name", required: true, max: 160 },
    { name: "company", label: "Company or trade", max: 200 },
    { name: "phone", label: "Phone", type: "tel", max: 80 },
    { name: "email", label: "Email", type: "email", max: 254 },
    { name: "website", label: "Website", type: "url", max: 2000 },
    {
      name: "notes",
      label: "When to call & notes",
      type: "textarea",
      max: 4000,
    },
  ],
  commitments: [
    { name: "title", label: "Commitment", required: true, max: 160 },
    { name: "provider", label: "Provider", max: 200 },
    {
      name: "responsible_member_id",
      label: "Who keeps an eye on it",
      type: "select",
    },
    { name: "renewal_on", label: "Next renewal", type: "date" },
    {
      name: "notice_days",
      label: "Notice period in days",
      type: "number",
      initial: "0",
      max: 730,
      required: true,
    },
    {
      name: "expected_amount_cents",
      label: "Expected cost (CHF)",
      type: "money",
    },
    {
      name: "billing_interval",
      label: "Billing interval",
      type: "select",
      choices: ["monthly", "yearly", "weekly", "one_off"],
      initial: "monthly",
      required: true,
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      choices: ["active", "cancel_requested", "ended"],
      initial: "active",
      required: true,
    },
    {
      name: "recurring_expense_rule_id",
      label: "Recurring expense rule",
      type: "select",
    },
    { name: "contact_id", label: "Contact", type: "select" },
    { name: "website", label: "Manage online", type: "url", max: 2000 },
    { name: "notes", label: "Terms & notes", type: "textarea", max: 8000 },
  ],
  decisions: [
    {
      name: "title",
      label: "What are you considering?",
      required: true,
      max: 200,
    },
    {
      name: "notes",
      label: "What matters to both of you?",
      type: "textarea",
      max: 8000,
    },
    { name: "project_id", label: "Related trip or project", type: "select" },
  ],
  documents: [
    { name: "title", label: "Document name", required: true, max: 200 },
    { name: "file_path", label: "File", type: "attachment", required: true },
    { name: "asset_id", label: "Inventory item", type: "select" },
    { name: "commitment_id", label: "Commitment", type: "select" },
    { name: "project_id", label: "Trip or project", type: "select" },
    { name: "booking_id", label: "Booking", type: "select" },
  ],
  maintenance: [
    { name: "title", label: "Work carried out", required: true, max: 200 },
    {
      name: "performed_on",
      label: "Performed on",
      type: "date",
      required: true,
    },
    { name: "routine_id", label: "Related routine", type: "select" },
    {
      name: "notes",
      label: "Work, parts & notes",
      type: "textarea",
      max: 4000,
    },
  ],
  options: [
    { name: "title", label: "Option", required: true, max: 200 },
    {
      name: "estimated_amount_cents",
      label: "Estimated cost (CHF)",
      type: "money",
    },
    { name: "website", label: "Website", type: "url", max: 2000 },
    {
      name: "notes",
      label: "Pros, cons & what matters",
      type: "textarea",
      max: 4000,
    },
  ],
  routines: [
    {
      name: "routine_id",
      label: "Maintenance routine",
      type: "select",
      required: true,
    },
  ],
};
export const labels: Record<
  RecordKind,
  { title: string; singular: string; intro: string }
> = {
  inventory: {
    title: "Inventory",
    singular: "item",
    intro: "The things you own, with warranties and care in one place.",
  },
  contacts: {
    title: "Useful contacts",
    singular: "contact",
    intro: "Know who to call when something needs attention.",
  },
  commitments: {
    title: "Commitments & renewals",
    singular: "commitment",
    intro:
      "Keep track of subscriptions, notice periods, and who is looking after them.",
  },
  decisions: {
    title: "Decisions & wishlist",
    singular: "decision",
    intro: "Save ideas, compare the options, and decide together.",
  },
  documents: {
    title: "Documents",
    singular: "document",
    intro: "Private manuals, receipts, warranties, and agreements.",
  },
  maintenance: {
    title: "Maintenance history",
    singular: "maintenance record",
    intro: "What was done and when.",
  },
  options: {
    title: "Compare options",
    singular: "option",
    intro: "A shared place for pros, cons, and expected costs.",
  },
  routines: {
    title: "Regular care",
    singular: "routine link",
    intro: "Connect the routines that keep this item in good shape.",
  },
};
export const humanLabel = (value: string) =>
  value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
