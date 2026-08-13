"use client";

import { useState } from "react";

import { FormField, FormSection } from "@/ui/forms/form-page";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";
import { FormSelect } from "@/ui/forms/form-select.client";

type Member = { user_id: string; display_name: string };

const policies = [
  { label: "Shared", value: "shared" },
  { label: "Assigned", value: "assigned" },
  { label: "Alternating", value: "alternating" },
] as const;

export type AssignmentPolicy = (typeof policies)[number]["value"];

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
  const match = policies.find((policy) => policy.value === value);
  return match === undefined ? "shared" : match.value;
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
  const [policy, setPolicy] = useState<AssignmentPolicy>(
    toPolicy(useFormFieldValue("assignmentPolicy", defaultPolicy)),
  );
  const [memberId, setMemberId] = useState(
    useFormFieldValue("memberId", defaultMemberId ?? members[0]?.user_id ?? ""),
  );

  return (
    <FormSection legend="Responsibility">
      <FormField label="Assignment">
        <FormSelect
          items={[...policies]}
          name="assignmentPolicy"
          onValueChange={(value) => setPolicy(toPolicy(value))}
          value={policy}
        />
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
          <FormSelect
            items={members.map((member) => ({
              label: member.display_name,
              value: member.user_id,
            }))}
            name="memberId"
            onValueChange={setMemberId}
            value={memberId}
          />
        </FormField>
      )}
    </FormSection>
  );
}
