import { z } from "zod";

export function parseHomeItem(formData: FormData) {
  return z
    .object({
      id: z.string().uuid("Choose an existing household item."),
      name: z.string().trim().min(1, "Enter a name.").max(80),
    })
    .parse({ id: formData.get("id"), name: formData.get("name") });
}
