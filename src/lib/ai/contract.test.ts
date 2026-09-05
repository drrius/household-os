import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AI_TOOL_DEFINITIONS } from "./definitions";
import { AI_READ_HANDLERS } from "./read-registry";
import { AI_WRITE_HANDLERS, executeAiWrite } from "./execute";
import { buildAssistantTools, buildToolApproval } from "./toolkit";
import {
  isFinancialTool,
  activityLabel,
} from "@/ui/assistant/assistant-tool-labels";
it(`exposes all ${AI_TOOL_DEFINITIONS.length} advertised actions through the shared runtime with no orphan executor`, () => {
  const reads = AI_TOOL_DEFINITIONS.filter((tool) => tool.kind === "read")
    .map((tool) => tool.name)
    .sort();
  const writes = AI_TOOL_DEFINITIONS.filter((tool) => tool.kind !== "read")
    .map((tool) => tool.name)
    .sort();
  expect(Object.keys(AI_READ_HANDLERS).sort()).toEqual(reads);
  expect(Object.keys(AI_WRITE_HANDLERS).sort()).toEqual(writes);
  expect(Object.keys(buildAssistantTools()).sort()).toEqual(
    AI_TOOL_DEFINITIONS.map((tool) => tool.name).sort(),
  );
});
it("requires approval for every ledger mutation and shows its financial warning", () => {
  const approval = buildToolApproval();
  for (const definition of AI_TOOL_DEFINITIONS) {
    expect(approval[definition.name]).toBe(
      definition.kind === "financial" ? "user-approval" : undefined,
    );
    expect(isFinancialTool(definition.name)).toBe(
      definition.kind === "financial",
    );
  }
});
it("refuses writes without a stable invocation identity before executing", async () => {
  await expect(executeAiWrite("save_project", {}, "")).rejects.toThrow(
    "stable tool invocation ID",
  );
});

it("gives every registered tool distinct running and completed descriptions", () => {
  for (const tool of AI_TOOL_DEFINITIONS) {
    expect(activityLabel(tool.name, "done"), tool.name).not.toBe(
      activityLabel(tool.name, "running"),
    );
    expect(activityLabel(tool.name, "failed"), tool.name).not.toBe(
      activityLabel(tool.name, "done"),
    );
  }
});
