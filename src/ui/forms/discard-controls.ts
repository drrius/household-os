import { discardSnapshot, type DiscardValue } from "./discard-values";

function readValues(form: HTMLFormElement): DiscardValue[] {
  const values: DiscardValue[] = [];
  for (const control of Array.from(form.elements)) {
    if (control instanceof HTMLInputElement) {
      if (["submit", "button", "reset", "image"].includes(control.type))
        continue;
      if (["checkbox", "radio"].includes(control.type) && !control.checked)
        continue;
      if (control.type === "file") {
        for (const file of Array.from(control.files ?? [])) {
          values.push({
            name: control.name,
            value: JSON.stringify([file.name, file.size, file.lastModified]),
          });
        }
        continue;
      }
      values.push({ name: control.name, value: control.value });
    } else if (control instanceof HTMLTextAreaElement) {
      values.push({ name: control.name, value: control.value });
    } else if (control instanceof HTMLSelectElement) {
      for (const option of Array.from(control.selectedOptions))
        values.push({ name: control.name, value: option.value });
    }
  }
  // Disabled controls retain their values: pending UI must not manufacture edits.
  return values;
}

function textControl(
  control: Element,
): control is HTMLInputElement | HTMLTextAreaElement {
  return (
    control instanceof HTMLTextAreaElement ||
    (control instanceof HTMLInputElement &&
      ![
        "hidden",
        "checkbox",
        "radio",
        "file",
        "submit",
        "reset",
        "button",
        "image",
      ].includes(control.type))
  );
}
function replaceValue(values: DiscardValue[], name: string, value: string) {
  return [...values.filter((entry) => entry.name !== name), { name, value }];
}

export function createDiscardControls(form: HTMLFormElement) {
  let baseline = readValues(form);
  const edited = new Set<string>();
  return {
    input(event: Event) {
      const control = event.target;
      if (
        !(control instanceof Element) ||
        !textControl(control) ||
        edited.has(control.name)
      )
        return;
      // Capture before React's bubbling onChange can update a controlled default.
      baseline = replaceValue(baseline, control.name, control.defaultValue);
      edited.add(control.name);
    },
    dirty() {
      let expected = baseline;
      for (const control of Array.from(form.elements)) {
        // Untouched text follows a refreshed default. Once edited, its original
        // baseline survives future defaults and failed-save recovery remounts.
        if (textControl(control) && !edited.has(control.name)) {
          expected = replaceValue(expected, control.name, control.defaultValue);
        }
      }
      return discardSnapshot(readValues(form)) !== discardSnapshot(expected);
    },
    discard() {
      baseline = readValues(form);
      for (const entry of baseline) edited.add(entry.name);
    },
    saved() {
      baseline = readValues(form);
      edited.clear();
    },
  };
}
