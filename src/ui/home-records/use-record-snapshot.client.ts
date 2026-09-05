"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import type { HomeRecord } from "@/domain/home-records/schema";
import type { RecordOptions } from "@/lib/home-records/options";
import { formatCentimesField } from "@/domain/money/chf";
import { type RecordField } from "./fields";
export function recordFieldValue(record: HomeRecord, field: RecordField) {
  const value = record[field.name];
  return typeof value === "number" && field.type === "money"
    ? formatCentimesField(value)
    : String(value ?? field.initial ?? "");
}
export function useRecordSnapshot(
  editableFields: readonly RecordField[],
  record: HomeRecord,
  options: RecordOptions,
) {
  const holder = useRef<HTMLDivElement>(null);
  const [initial] = useState({ record, options });
  const [snapshot, setSnapshot] = useState<typeof initial | null>(null);
  const current = useMemo(
    () =>
      snapshot ?? {
        record: record.updated_at ? record : initial.record,
        options,
      },
    [record, options, snapshot, initial],
  );
  const snapshotKey = useMemo(() => JSON.stringify(current), [current]);
  const capture = useCallback(() => {
    const form = holder.current?.querySelector("form");
    if (!form) return;
    const values = new FormData(form);
    const dirty =
      editableFields.some(
        (field) =>
          values.has(field.name) &&
          values.get(field.name) !== recordFieldValue(current.record, field),
      ) ||
      [...values.values()].some(
        (value) => value instanceof File && value.name !== "",
      );
    setSnapshot(dirty ? current : null);
  }, [editableFields, current]);
  return {
    holder,
    current,
    snapshotKey,
    capture,
    freeze: () => setSnapshot(current),
  };
}
