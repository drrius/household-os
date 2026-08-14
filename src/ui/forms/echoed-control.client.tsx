"use client";

import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";

export function EchoedInput({
  initialValue = "",
  name,
  ...props
}: Omit<ComponentProps<typeof Input>, "defaultValue"> & {
  initialValue?: string;
  name: string;
}) {
  return (
    <Input
      {...props}
      defaultValue={useFormFieldValue(name, initialValue)}
      name={name}
    />
  );
}

export function EchoedTextarea({
  initialValue = "",
  name,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "defaultValue"> & {
  initialValue?: string;
  name: string;
}) {
  return (
    <Textarea
      {...props}
      defaultValue={useFormFieldValue(name, initialValue)}
      name={name}
    />
  );
}
