import { recordSettlementAction } from "@/app/(product)/_actions/m7-money";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import {
  FormField,
  FormFields,
  FormPage,
  selectClassName,
} from "@/ui/forms/form-page";

export default async function NewSettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const query = await searchParams;
  const mode = query.mode === "partial" ? "partial" : "full";
  return (
    <FormPage
      backHref="/money"
      description="Record an external transfer; Household OS never moves money itself."
      error={query.error}
      title="Record settlement"
    >
      <FormFields
        action={recordSettlementAction}
        submitLabel="Record settlement"
      >
        <input
          name="idempotencyKey"
          type="hidden"
          value={crypto.randomUUID()}
        />
        <FormField label="Settlement">
          <select className={selectClassName} defaultValue={mode} name="mode">
            <option value="full">Full current balance</option>
            <option value="partial">Partial amount</option>
          </select>
        </FormField>
        <FormField
          label="Partial amount in CHF"
          description="Ignored for a full settlement."
        >
          <Input inputMode="decimal" name="amount" placeholder="0.00" />
        </FormField>
        <FormField label="Date">
          <Input
            defaultValue={zurichCivilDate()}
            name="occurredOn"
            required
            type="date"
          />
        </FormField>
        <FormField label="Note">
          <Textarea maxLength={4000} name="note" />
        </FormField>
      </FormFields>
    </FormPage>
  );
}
