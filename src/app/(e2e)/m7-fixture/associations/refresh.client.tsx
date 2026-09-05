"use client";
import { useState } from "react";
import { AssociationConfirmation } from "@/ui/money/association-confirmation.client";
import type { FormAction } from "@/lib/forms/action-state";
const id = "00000000-0000-4000-8000-000000000001";
export function RefreshConfirmation({
  action,
  remove,
}: {
  action: FormAction;
  remove: boolean;
}) {
  const [refreshed, setRefreshed] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setRefreshed(true)}>
        Simulate partner refresh
      </button>
      <output>{refreshed ? "Server changed" : "Original server"}</output>
      <AssociationConfirmation
        action={action}
        payerName="Alex"
        expense={{
          id,
          description: "Zurich flight",
          payer_member_id: id,
          amount_cents: 12501,
          occurred_on: "2026-09-05",
          type: remove ? "replacement" : "expense",
        }}
        currentTitle={refreshed ? "Partner destination" : "Summer holiday"}
        destinationTitle={remove ? null : "Autumn holiday"}
        revision={refreshed ? "00000000-0000-4000-8000-000000000002" : id}
        requestId={crypto.randomUUID()}
      />
    </>
  );
}
