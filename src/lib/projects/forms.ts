import { z } from "zod";
import { parseChfToCentimes } from "@/domain/money/chf";
import { FormFieldError } from "@/lib/forms/field-error";

export const recordId = (value: FormDataEntryValue | null) =>
  z.uuid("This record is no longer available.").parse(value);
const text = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
const optional = (value: string) => value || null;
export const recordVersion = (form: FormData) =>
  z.iso
    .datetime({ offset: true })
    .nullable()
    .parse(optional(text(form, "updatedAt")));
const date = (form: FormData, name: string) =>
  z.iso
    .date("Choose a valid date.")
    .nullable()
    .parse(optional(text(form, name)));
export function optionalAmount(form: FormData, name: string) {
  const value = text(form, name);
  if (!value) return null;
  try {
    return parseChfToCentimes(value);
  } catch {
    throw new FormFieldError(
      name,
      "Enter a CHF amount with up to two decimal places.",
    );
  }
}

export function parseProjectForm(form: FormData) {
  const starts_on = date(form, "starts_on"),
    ends_on = date(form, "ends_on");
  if (starts_on && ends_on && ends_on < starts_on)
    throw new FormFieldError(
      "ends_on",
      "The end date must be on or after the start date.",
    );
  return {
    id: recordId(form.get("id")),
    version: recordVersion(form),
    fields: {
      kind: z.enum(["project", "trip"]).parse(form.get("kind")),
      title: z
        .string()
        .min(1, "Give this plan a name.")
        .max(160)
        .parse(text(form, "title")),
      description: z.string().max(8000).parse(text(form, "description")),
      status: z
        .enum(["planning", "active", "complete", "cancelled"])
        .parse(form.get("status") ?? "planning"),
      starts_on,
      ends_on,
      destination: z.string().max(300).parse(text(form, "destination")),
      budget_cents: optionalAmount(form, "budget"),
    },
  };
}

export function parseTaskForm(form: FormData) {
  return {
    id: recordId(form.get("id")),
    version: recordVersion(form),
    fields: {
      project_id: recordId(form.get("project_id")),
      title: z
        .string()
        .min(1, "Give this task a name.")
        .max(200)
        .parse(text(form, "title")),
      section: z
        .string()
        .min(1)
        .max(80)
        .parse(text(form, "section") || "Tasks"),
      assigned_member_id: z
        .uuid()
        .nullable()
        .parse(optional(text(form, "assigned_member_id"))),
      due_on: date(form, "due_on"),
      notes: z.string().max(4000).parse(text(form, "notes")),
    },
  };
}

export function safeBookingUrl(value: string): string {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error();
    return z.string().max(2000).parse(parsed.href);
  } catch {
    throw new FormFieldError(
      "website",
      "Use a complete http:// or https:// link without a password.",
    );
  }
}
