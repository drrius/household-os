"use client";
import { DocumentLinks } from "./document-links.client";
import { useId, type ComponentProps } from "react";
import type { HomeRecord, RecordKind } from "@/domain/home-records/schema";
import {
  recordFieldValue,
  useRecordSnapshot,
} from "./use-record-snapshot.client";
import type { RecordOptions } from "@/lib/home-records/options";
import type { FormAction } from "@/lib/forms/action-state";
import { recordAction } from "@/app/(product)/home/record-actions";
import { AttachmentField } from "@/ui/attachments/attachment-field.client";
import {
  FormFields,
  useFormFieldValue,
  useFormFieldsState,
} from "@/ui/forms/form-fields.client";
import { fields, humanLabel, labels, type RecordField } from "./fields";
const control =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base sm:text-sm";
function RecordControl({
  field,
  record,
  options,
  attachmentChanged,
}: {
  attachmentChanged?: () => void;
  field: RecordField;
  record: HomeRecord;
  options: RecordOptions;
}) {
  const id = useId();
  const value = useFormFieldValue(field.name, recordFieldValue(record, field));
  const error = useFormFieldsState().errors[field.name];
  const props = {
    id,
    name: field.name,
    defaultValue: value,
    required: field.required,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${id}-error` : undefined,
    className: control,
  };
  return (
    <div className="grid gap-2">
      {field.type === "attachment" ? (
        <AttachmentField
          required
          label="File"
          name={field.name}
          purpose="documents"
          initialPath={value}
          onStateChange={attachmentChanged}
        />
      ) : (
        <>
          <label className="font-medium" htmlFor={id}>
            {field.label}
            {!field.required ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                (optional)
              </span>
            ) : null}
          </label>
          {field.type === "select" ? (
            <RecordSelect field={field} options={options} props={props} />
          ) : field.type === "textarea" ? (
            <textarea {...props} rows={4} maxLength={field.max} />
          ) : (
            <input
              {...props}
              type={field.type === "money" ? "text" : (field.type ?? "text")}
              inputMode={field.type === "money" ? "decimal" : undefined}
              min={field.type === "number" ? 0 : undefined}
              max={field.type === "number" ? field.max : undefined}
              maxLength={field.type === "number" ? undefined : field.max}
            />
          )}
        </>
      )}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
function RecordSelect({
  field,
  options,
  props,
}: {
  field: RecordField;
  options: RecordOptions;
  props: ComponentProps<"select">;
}) {
  return (
    <select {...props}>
      <option value="">
        {field.required
          ? "Choose…"
          : field.name === "responsible_member_id"
            ? "Either of you"
            : "Not linked"}
      </option>
      {(
        field.choices?.map((choice) => ({
          value: choice,
          label: humanLabel(choice),
        })) ??
        options[field.name] ??
        []
      ).map((choice) => (
        <option key={choice.value} value={choice.value}>
          {choice.label}
        </option>
      ))}
    </select>
  );
}
function RecordIdentity({ record }: { record: HomeRecord }) {
  return (
    <>
      <input
        type="hidden"
        name="id"
        value={useFormFieldValue("id", record.id)}
      />
      <input
        type="hidden"
        name="version"
        value={useFormFieldValue("version", record.updated_at ?? "")}
      />
    </>
  );
}
type RecordFormProps = {
  kind: RecordKind;
  record: HomeRecord;
  options: RecordOptions;
  returnTo: string;
  parent?: { column: string; id: string };
  action?: FormAction;
};
export function RecordForm(props: RecordFormProps) {
  const identity = props.record.updated_at ? props.record.id : "new";
  return (
    <RecordFormSession
      key={`${props.kind}:${identity}:${props.parent?.id ?? ""}`}
      {...props}
    />
  );
}
function visibleFields(kind: RecordKind, parent?: RecordFormProps["parent"]) {
  return fields[kind].filter(
    (field) =>
      field.name !== parent?.column &&
      !(
        kind === "documents" &&
        ["asset_id", "commitment_id", "project_id", "booking_id"].includes(
          field.name,
        )
      ),
  );
}
function RecordFormSession({
  kind,
  record: incomingRecord,
  options: incomingOptions,
  returnTo,
  parent,
  action = recordAction,
}: RecordFormProps) {
  const { holder, current, snapshotKey, capture, freeze } = useRecordSnapshot(
    fields[kind].filter((field) => field.name !== parent?.column),
    incomingRecord,
    incomingOptions,
  );
  const { record, options } = current;
  return (
    <div
      ref={holder}
      onInputCapture={capture}
      onChangeCapture={capture}
      onSubmitCapture={freeze}
    >
      <FormFields
        key={snapshotKey}
        action={action}
        protectChanges
        submitLabel={
          record.updated_at ? "Save changes" : `Add ${labels[kind].singular}`
        }
      >
        <input type="hidden" name="kind" value={kind} />
        <RecordIdentity record={record} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {parent ? (
          <input type="hidden" name={parent.column} value={parent.id} />
        ) : null}
        <div className="@container">
          <div className="grid gap-5 @xl:grid-cols-2">
            {visibleFields(kind, parent).map((field) => (
              <div
                key={field.name}
                className={
                  field.type === "textarea" || field.type === "attachment"
                    ? "@xl:col-span-2"
                    : undefined
                }
              >
                <RecordControl
                  field={field}
                  record={record}
                  options={options}
                  attachmentChanged={capture}
                />
              </div>
            ))}
          </div>
        </div>
        {kind === "documents" ? (
          <DocumentLinks record={record} options={options} parent={parent} />
        ) : null}
        {kind === "commitments" || kind === "options" ? (
          <p className="text-muted-foreground">
            Expected costs help you plan. They do not change your balance.
          </p>
        ) : null}
        {kind === "documents" ? (
          <p className="text-muted-foreground">
            Choose one related record, or keep this document in your shared
            library.
          </p>
        ) : null}
      </FormFields>
    </div>
  );
}
