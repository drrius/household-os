import { z } from "zod";
export function parseMealPreparationEdit(form: FormData) {
  return {
    entryId: z.string().uuid().parse(form.get("entryId")),
    title: z.string().trim().min(1).max(120).parse(form.get("title")),
    instructions: z
      .string()
      .trim()
      .max(4000)
      .parse(form.get("instructions") ?? ""),
    areaId: z.string().uuid().parse(form.get("areaId")),
    assignedMemberId: form.get("assignedMemberId")
      ? z.string().uuid().parse(form.get("assignedMemberId"))
      : null,
    dueOn: z.iso.date().parse(form.get("dueOn")),
  };
}
