import type { ProjectKind } from "./types";

export const projectStarters = [
  {
    key: "project",
    label: "Get a project moving",
    section: "Getting started",
    kinds: ["project"],
    tasks: [
      ["outcome", "Agree what finished looks like"],
      ["next-step", "Choose the first practical step"],
      ["materials", "List the materials and people needed"],
      ["budget", "Agree a budget and target date"],
    ],
  },
  {
    key: "travel",
    label: "Plan the trip",
    section: "Travel plans",
    kinds: ["trip"],
    tasks: [
      ["dates", "Agree dates and a trip budget"],
      ["transport", "Choose and book transport"],
      ["stay", "Choose and book somewhere to stay"],
      ["confirmations", "Save booking confirmations and important details"],
    ],
  },
  {
    key: "packing",
    label: "Pack the essentials",
    section: "Packing",
    kinds: ["trip"],
    tasks: [
      ["documents", "Check travel documents and entry requirements"],
      ["clothes", "Pack clothes for the weather and plans"],
      ["toiletries", "Pack toiletries and everyday medication"],
      ["chargers", "Pack chargers and the right adapters"],
      ["day-bag", "Pack a day bag and water bottle"],
    ],
  },
  {
    key: "away",
    label: "Get home ready",
    section: "Before we leave",
    kinds: ["trip"],
    tasks: [
      ["care", "Arrange any pet and plant care"],
      ["food", "Use or freeze food that will not keep"],
      ["bins", "Empty bins and check collection day"],
      ["keys", "Agree keys, access and an emergency contact"],
      ["last-check", "Check doors, windows and appliances before leaving"],
    ],
  },
] as const;

export function startersFor(kind: ProjectKind) {
  return projectStarters.filter((starter) =>
    (starter.kinds as readonly string[]).includes(kind),
  );
}

export function starterTasks(
  kind: ProjectKind,
  preset: string,
  selected: readonly string[],
  ids: Readonly<Record<string, string>>,
) {
  const starter = startersFor(kind).find((item) => item.key === preset);
  if (
    !starter ||
    selected.length === 0 ||
    selected.length > 20 ||
    new Set(selected).size !== selected.length
  )
    throw new Error("Choose a checklist and at least one task.");
  return selected.map((key) => {
    const task = starter.tasks.find((item) => item[0] === key);
    const id = ids[`${preset}:${key}`];
    if (!task || !id)
      throw new Error(
        "This checklist selection is invalid. Reload and try again.",
      );
    return { id, title: task[1], section: starter.section, notes: "" };
  });
}
