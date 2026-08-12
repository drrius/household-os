"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { FormField, FormSection, selectClassName } from "@/ui/forms/form-page";

type Member = { user_id: string; display_name: string };
type SplitMode = "equal" | "exact";

function toSplitMode(value: string): SplitMode {
  return value === "exact" ? "exact" : "equal";
}

function centsInput(value: number | undefined): string {
  if (value === undefined) return "";
  return `${Math.floor(Math.abs(value) / 100)}.${String(Math.abs(value) % 100).padStart(2, "0")}`;
}

export function ExpenseSplitFields({
  initialExactCents = {},
  initialMode = "equal",
  members,
}: {
  initialExactCents?: Readonly<Record<string, number>>;
  initialMode?: SplitMode;
  members: readonly Member[];
}) {
  const [splitMode, setSplitMode] = useState<SplitMode>(initialMode);
  return (
    <FormSection legend="Split">
      <FormField label="Allocation">
        <select
          className={selectClassName}
          defaultValue={initialMode}
          name="splitMode"
          onChange={(event) => setSplitMode(toSplitMode(event.target.value))}
        >
          <option value="equal">50/50</option>
          <option value="exact">Exact amounts</option>
        </select>
      </FormField>
      {splitMode === "exact" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {members.map((member) => (
            <FormField
              key={member.user_id}
              label={`${member.display_name}'s exact share`}
            >
              <Input
                defaultValue={centsInput(initialExactCents[member.user_id])}
                inputMode="decimal"
                name={`allocation:${member.user_id}`}
                placeholder="0.00"
              />
            </FormField>
          ))}
        </div>
      ) : null}
    </FormSection>
  );
}
