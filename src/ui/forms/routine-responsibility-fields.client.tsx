"use client";

import { useState, type ReactNode } from "react";

import { useFormFieldsState } from "@/ui/forms/form-fields.client";
import { FormField, FormSection, selectClassName } from "@/ui/forms/form-page";

type Member = { user_id: string; display_name: string };

const policies = [
  ["shared", "Shared"],
  ["assigned", "Assigned"],
  ["alternating", "Alternating"],
] as const;

export type AssignmentPolicy = (typeof policies)[number][0];

/** `shared` drops the submitted member, so the control is not offered for it. */
const memberCopy = {
  alternating: {
    description:
      "The rotation starts here and then alternates after each completion.",
    label: "Rotation starter",
  },
  assigned: {
    description: "This member is responsible every time.",
    label: "Assigned member",
  },
} as const;

function toPolicy(value: string): AssignmentPolicy {
  const match = policies.find(([policy]) => policy === value);
  return match === undefined ? "shared" : match[0];
}

/**
 * The Assignment control decides whether the member control exists, so both are
 * controlled. `FormField` injects the echoed value of a rejected submit as
 * `defaultValue`, and React refuses a `<select>` carrying both; the echo is
 * seeded into state instead, so the injected default is dropped here.
 */
function ResponsibilitySelect({
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  children,
  id,
  name,
  onValueChange,
  value,
}: {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  children: ReactNode;
  id?: string;
  name: string;
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <select
      aria-describedby={describedBy}
      aria-invalid={invalid}
      className={selectClassName}
      id={id}
      name={name}
      onChange={(event) => onValueChange(event.target.value)}
      value={value}
    >
      {children}
    </select>
  );
}

export function RoutineResponsibilityFields({
  defaultMemberId,
  defaultPolicy,
  members,
}: {
  defaultMemberId: string | null;
  defaultPolicy: AssignmentPolicy;
  members: readonly Member[];
}) {
  const { values } = useFormFieldsState();
  const [policy, setPolicy] = useState<AssignmentPolicy>(() =>
    toPolicy(values.assignmentPolicy ?? defaultPolicy),
  );
  // Held apart from the policy so switching back to Assigned restores the
  // previous pick instead of snapping to the first member.
  const [memberId, setMemberId] = useState(
    () => values.memberId ?? defaultMemberId ?? members[0]?.user_id ?? "",
  );

  return (
    <FormSection legend="Responsibility">
      <FormField label="Assignment">
        <ResponsibilitySelect
          name="assignmentPolicy"
          onValueChange={(value) => setPolicy(toPolicy(value))}
          value={policy}
        >
          {policies.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </ResponsibilitySelect>
      </FormField>
      {policy === "shared" ? (
        <p className="text-sm text-muted-foreground">
          Either of you can complete this routine.
        </p>
      ) : (
        <FormField
          description={memberCopy[policy].description}
          label={memberCopy[policy].label}
        >
          <ResponsibilitySelect
            name="memberId"
            onValueChange={setMemberId}
            value={memberId}
          >
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.display_name}
              </option>
            ))}
          </ResponsibilitySelect>
        </FormField>
      )}
    </FormSection>
  );
}
