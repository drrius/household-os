"use client";
import { useId, useState } from "react";
import type { HomeRecord } from "@/domain/home-records/schema";
import type { RecordOptions } from "@/lib/home-records/options";
import {
  useFormFieldValue,
  useFormFieldsState,
} from "@/ui/forms/form-fields.client";
const labels = {
  asset_id: "Inventory item",
  commitment_id: "Commitment",
  project_id: "Trip or project",
  booking_id: "Booking",
};
type Field = keyof typeof labels;
export function DocumentLinks({
  record,
  options,
  parent,
}: {
  record: HomeRecord;
  options: RecordOptions;
  parent?: { column: string; id: string };
}) {
  const initial = {
    asset_id: useFormFieldValue("asset_id", String(record.asset_id ?? "")),
    commitment_id: useFormFieldValue(
      "commitment_id",
      String(record.commitment_id ?? ""),
    ),
    project_id: useFormFieldValue(
      "project_id",
      String(record.project_id ?? ""),
    ),
    booking_id: useFormFieldValue(
      "booking_id",
      String(record.booking_id ?? ""),
    ),
  };
  const [values, setValues] = useState({
    ...initial,
    ...(parent ? { [parent.column]: parent.id } : {}),
  });
  function change(field: Field, value: string) {
    setValues((previous) => {
      if (field === "booking_id") return { ...previous, booking_id: value };
      // Choosing one parent explicitly clears incompatible links.
      return {
        asset_id: "",
        commitment_id: "",
        project_id: "",
        booking_id: "",
        [field]: value,
      };
    });
  }
  const visible = (Object.keys(labels) as Field[]).filter(
    (field) =>
      !parent || (field === "booking_id" && parent.column === "project_id"),
  );
  return (
    <div className="grid gap-4">
      {visible.map((field) => {
        const choices = (options[field] ?? []).filter(
          (choice) =>
            field !== "booking_id" || choice.projectId === values.project_id,
        );
        return (
          <DocumentSelect
            key={field}
            field={field}
            value={values[field]}
            choices={choices}
            disabled={field === "booking_id" && !values.project_id}
            onChange={(value) => change(field, value)}
          />
        );
      })}
    </div>
  );
}

function DocumentSelect({
  field,
  value,
  choices,
  disabled,
  onChange,
}: {
  field: Field;
  value: string;
  choices: RecordOptions[string];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const { errors } = useFormFieldsState();
  return (
    <div className="grid gap-2">
      <label htmlFor={`${id}-${field}`} className="font-medium">
        {labels[field]}{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <select
        id={`${id}-${field}`}
        name={field}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(errors[field])}
        aria-describedby={errors[field] ? `${id}-${field}-error` : undefined}
        className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-sm"
      >
        <option value="">
          {disabled ? "Choose a trip first" : "Not linked"}
        </option>
        {choices.map((choice) => (
          <option value={choice.value} key={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
      {errors[field] ? (
        <p
          role="alert"
          id={`${id}-${field}-error`}
          className="text-destructive-strong"
        >
          {errors[field]}
        </p>
      ) : null}
    </div>
  );
}
