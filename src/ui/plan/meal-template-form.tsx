import type { ComponentProps } from "react";
import { MealTemplateEditor } from "./meal-template-editor.client";

export function MealTemplateForm(
  props: Omit<ComponentProps<typeof MealTemplateEditor>, "id">,
) {
  return (
    <MealTemplateEditor
      key={`${props.libraryId}:${props.template?.id ?? "new"}`}
      {...props}
      id={props.template?.id ?? crypto.randomUUID()}
    />
  );
}
