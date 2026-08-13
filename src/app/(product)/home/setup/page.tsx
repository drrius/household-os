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
import { SavedNotice } from "@/ui/home/saved-notice.client";

const savedMessages = {
  area: "Area created.",
  household: "Household name updated.",
  pet: "Pet created.",
} as const;

/** `required` lets a space-only value through, so this is the client-side trim. */
const NON_BLANK_PATTERN = ".*\\S.*";
const NON_BLANK_TITLE = "Enter at least one character that is not a space.";

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
      description="Names you and your partner share. Areas and pets become the options you pick from when creating a routine."
      error={query.error}
      title="Home setup"
    >
      <SavedNotice message={saved} />
      <FormSection legend="Household">
        <FormFields
          action={updateHouseholdNameAction}
          submitLabel="Save household name"
        >
          <FormField
            description="Shown in the sidebar. You can change it any time."
            label="Household name"
          >
            <Input
              defaultValue={household.name}
              maxLength={120}
              name="name"
              pattern={NON_BLANK_PATTERN}
              required
              title={NON_BLANK_TITLE}
            />
          </FormField>
        </FormFields>
      </FormSection>
      <FormSection legend="Routine area">
        <FormFields action={createAreaAction} submitLabel="Create area">
          <FormField
            description="A part of the home a routine belongs to, for example Kitchen, Bathroom, or Garden."
            label="Area name"
          >
            <Input
              maxLength={80}
              name="name"
              pattern={NON_BLANK_PATTERN}
              required
              title={NON_BLANK_TITLE}
            />
          </FormField>
        </FormFields>
      </FormSection>
      <FormSection legend="Pet">
        <FormFields action={createPetAction} submitLabel="Create pet">
          <FormField
            description="Add each pet you care for so pet routines can be assigned to them."
            label="Pet name"
          >
            <Input
              maxLength={80}
              name="name"
              pattern={NON_BLANK_PATTERN}
              required
              title={NON_BLANK_TITLE}
            />
          </FormField>
        </FormFields>
      </FormSection>
    </FormPage>
  );
}
