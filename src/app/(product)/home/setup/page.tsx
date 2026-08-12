import {
  createAreaAction,
  createPetAction,
  updateHouseholdNameAction,
} from "@/app/(product)/_actions/m7-household";
import { Input } from "@/components/ui/input";
import { loadHouseholdSetup } from "@/lib/forms/options";
import {
  FormField,
  FormFields,
  FormPage,
  FormSection,
} from "@/ui/forms/form-page";

const savedMessages = {
  area: "Area created.",
  household: "Household name updated.",
  pet: "Pet created.",
} as const;

export default async function HomeSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [household, query] = await Promise.all([
    loadHouseholdSetup(),
    searchParams,
  ]);
  const saved =
    query.saved && query.saved in savedMessages
      ? savedMessages[query.saved as keyof typeof savedMessages]
      : null;
  return (
    <FormPage
      backHref="/home"
      description="Configure the minimum shared names used by routines and the household trial."
      error={query.error}
      title="Home setup"
    >
      {saved ? (
        <p role="status" className="text-sm font-medium text-primary">
          {saved}
        </p>
      ) : null}
      <FormSection legend="Household">
        <FormFields
          action={updateHouseholdNameAction}
          submitLabel="Save household name"
        >
          <FormField label="Household name">
            <Input
              defaultValue={household.name}
              maxLength={120}
              name="name"
              required
            />
          </FormField>
        </FormFields>
      </FormSection>
      <FormSection legend="Routine area">
        <FormFields action={createAreaAction} submitLabel="Create area">
          <FormField label="Area name">
            <Input maxLength={80} name="name" required />
          </FormField>
        </FormFields>
      </FormSection>
      <FormSection legend="Pet">
        <FormFields action={createPetAction} submitLabel="Create pet">
          <FormField label="Pet name">
            <Input maxLength={80} name="name" required />
          </FormField>
        </FormFields>
      </FormSection>
    </FormPage>
  );
}
