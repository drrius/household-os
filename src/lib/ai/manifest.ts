import { z } from "zod";

import { AI_TOOL_DEFINITIONS, type AiToolKind } from "@/lib/ai/definitions";

export type AiToolManifestEntry = {
  name: string;
  description: string;
  kind: AiToolKind;
  inputSchema: Record<string, unknown>;
};

/**
 * JSON-Schema view of the tool contract. The MCP worker fetches this at
 * session start and registers the tools dynamically, so the worker never
 * carries its own copy of the contract and cannot drift from the app.
 */
export function buildAiToolManifest(): readonly AiToolManifestEntry[] {
  return AI_TOOL_DEFINITIONS.map((definition) => ({
    name: definition.name,
    description: definition.description,
    kind: definition.kind,
    inputSchema: z.toJSONSchema(definition.inputSchema, {
      target: "draft-7",
      io: "input",
    }) as Record<string, unknown>,
  }));
}
