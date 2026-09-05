"use client";
import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reorderAreasAction } from "@/app/(product)/_actions/m7-household";
import {
  updateAreaAction,
  updatePetAction,
} from "@/app/(product)/_actions/m7-household";
import { EchoedInput } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields } from "@/ui/forms/form-page";

type Area = { id: string; name: string; sort_order: number };
type Pet = { id: string; name: string };

export function AreaMaintenance({ areas }: { areas: readonly Area[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function move(index: number, direction: -1 | 1) {
    const ids = areas.map((area) => area.id);
    const target = index + direction;
    if (!ids[target] || !ids[index]) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    startTransition(async () => {
      setError(null);
      const result = await reorderAreasAction(ids);
      setError(result.error ?? null);
    });
  }
  return (
    <div className="grid gap-3" id="areas">
      <h2 className="font-heading text-lg font-semibold">Your areas</h2>
      <p className="text-base text-muted-foreground sm:text-sm">
        Put the areas in the order that suits your home. Open a name to rename
        it.
      </p>
      <p aria-live="polite" className="text-destructive-strong">
        {error ?? (pending ? "Saving order…" : "")}
      </p>
      {areas.map((area, index) => (
        <div className="flex items-start gap-2 border-b pb-3" key={area.id}>
          <details className="min-w-0 flex-1">
            <summary className="min-h-11 cursor-pointer font-medium">
              {area.name}
            </summary>
            <FormFields
              action={updateAreaAction}
              submitLabel="Save area"
              showRequiredNotice={false}
              submitVariant="outline"
            >
              <input name="id" type="hidden" value={area.id} />
              <FormField label="Area name">
                <EchoedInput
                  name="name"
                  initialValue={area.name}
                  maxLength={80}
                  required
                />
              </FormField>
            </FormFields>
          </details>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Move ${area.name} up`}
              disabled={pending || index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Move ${area.name} down`}
              disabled={pending || index === areas.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown aria-hidden />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PetMaintenance({ pets }: { pets: readonly Pet[] }) {
  if (!pets.length) return null;
  return (
    <div className="grid gap-3 border-t pt-6" id="pets">
      <h2 className="font-heading text-lg font-semibold">Your pets</h2>
      {pets.map((pet) => (
        <details className="border-b pb-3" key={pet.id}>
          <summary className="min-h-11 cursor-pointer font-medium">
            {pet.name}
          </summary>
          <FormFields
            action={updatePetAction}
            submitLabel="Save pet"
            showRequiredNotice={false}
            submitVariant="outline"
          >
            <input name="id" type="hidden" value={pet.id} />
            <FormField label="Pet name">
              <EchoedInput
                name="name"
                initialValue={pet.name}
                maxLength={80}
                required
              />
            </FormField>
          </FormFields>
        </details>
      ))}
    </div>
  );
}
