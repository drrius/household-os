import {
  createAreaAction,
  createPetAction,
  updateHouseholdNameAction,
} from "@/app/(product)/_actions/m7-household";
import Link from "next/link";
import { AreaMaintenance, PetMaintenance } from "@/ui/home/home-maintenance";
import { loadHomeSettingsOptions } from "@/lib/routines/home-settings";
import { loadHouseholdSetup } from "@/lib/forms/options";
import { EchoedInput } from "@/ui/forms/echoed-control.client";
import {
  FormField,
  FormFields,
  FormPage,
  FormSection,
} from "@/ui/forms/form-page";
import { SavedNotice } from "@/ui/home/saved-notice.client";

const savedMessages = {
  area: "Area created.",
  "area-updated": "Area updated.",
  "pet-updated": "Pet updated.",
  household: "Household name updated.",
  pet: "Pet created.",
} as const;

/** `required` lets a space-only value through, so this is the client-side trim. */
const NON_BLANK_PATTERN = ".*\\S.*";
const NON_BLANK_TITLE = "Enter at least one character that is not a space.";

function HouseholdNameForm({ name }: { name: string }) {
  return (
    <FormSection legend="Household">
      <FormFields
        action={updateHouseholdNameAction}
        submitLabel="Save household name"
      >
        <FormField
          description="Shown in the sidebar. You can change it any time."
          label="Household name"
        >
          <EchoedInput
            initialValue={name}
            maxLength={120}
            name="name"
            pattern={NON_BLANK_PATTERN}
            required
            title={NON_BLANK_TITLE}
          />
        </FormField>
      </FormFields>
    </FormSection>
  );
}

export default async function HomeSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [household, query, options] = await Promise.all([
    loadHouseholdSetup(),
    searchParams,
    loadHomeSettingsOptions(),
  ]);
  const saved =
    query.saved && query.saved in savedMessages
      ? savedMessages[query.saved as keyof typeof savedMessages]
      : null;
  return (
    <FormPage
      backHref="/home"
      description="Names you and your partner share. Areas and pets become the options you pick from when creating a routine."
      title="Home setup"
    >
      <SavedNotice message={saved} />
      <p className="pb-6">
        Building your routine list?{" "}
        <Link href="/home/routines/starters">
          Start with a few household essentials.
        </Link>
      </p>
      <HouseholdNameForm name={household.name} />
      <AreaMaintenance areas={options.areas} />
      <FormSection legend="Add an area">
        <FormFields
          action={createAreaAction}
          submitLabel="Create area"
          showRequiredNotice={false}
          submitVariant="outline"
        >
          <FormField
            description="A part of the home a routine belongs to, for example Kitchen, Bathroom, or Garden."
            label="Area name"
          >
            <EchoedInput
              maxLength={80}
              name="name"
              pattern={NON_BLANK_PATTERN}
              required
              title={NON_BLANK_TITLE}
            />
          </FormField>
        </FormFields>
      </FormSection>
      <PetMaintenance pets={options.pets} />
      <FormSection legend="Add a pet">
        <FormFields
          action={createPetAction}
          submitLabel="Create pet"
          showRequiredNotice={false}
          submitVariant="outline"
        >
          <FormField
            description="Add each pet you care for so pet routines can be assigned to them."
            label="Pet name"
          >
            <EchoedInput
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
