"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";

function zoneOptions(initial: string) {
  const zones = new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]);
  try {
    new Intl.DateTimeFormat("en", { timeZone: initial });
    zones.add(initial);
  } catch {
    // A rejected draft may contain an invalid zone; do not suggest it.
  }
  return [...zones].sort();
}

export function TimeZoneField({
  name,
  label,
  initial,
}: {
  name: string;
  label: string;
  initial: string;
}) {
  const echoed = useFormFieldValue(name, initial);
  const [value, setValue] = useState(echoed);
  const input = useRef<HTMLInputElement>(null);
  const previousValue = useRef(value);
  const zones = useMemo(() => zoneOptions(initial), [initial]);
  useEffect(() => {
    if (previousValue.current === value) return;
    previousValue.current = value;
    // Choosing a suggestion must reach the form's native dirty-field tracking.
    input.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [value]);
  return (
    <Autocomplete.Root
      items={zones}
      value={value}
      onValueChange={setValue}
      filter={(zone, query) =>
        zone
          .replaceAll("_", " ")
          .toLowerCase()
          .includes(query.replaceAll("_", " ").trim().toLowerCase())
      }
    >
      <FormField
        name={name}
        label={label}
        description="Search a city, such as Zurich, London or New York."
      >
        <Autocomplete.Input
          name={name}
          ref={input}
          required
          maxLength={100}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 w-full min-w-0 rounded-4xl border border-input bg-field/30 px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
        />
      </FormField>
      <ZoneSuggestions />
    </Autocomplete.Root>
  );
}

function ZoneSuggestions() {
  return (
    <Autocomplete.Portal>
      <Autocomplete.Positioner className="z-50" sideOffset={4} align="start">
        <Autocomplete.Popup className="w-[var(--anchor-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-xl">
          <Autocomplete.Empty className="p-4 text-sm">
            No matching city. Try a nearby major city in the same time zone.
          </Autocomplete.Empty>
          <Autocomplete.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto overscroll-contain p-1">
            {(zone: string) => (
              <Autocomplete.Item
                key={zone}
                value={zone}
                className="min-h-11 cursor-pointer content-center rounded-xl px-3 py-2 text-base wrap-anywhere data-highlighted:bg-accent"
              >
                {zone.replaceAll("_", " ")}
              </Autocomplete.Item>
            )}
          </Autocomplete.List>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  );
}
