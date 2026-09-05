import "server-only";
import { getAiToolDefinition } from "./definitions";
import { executeAiWrite } from "./execute";
import { AI_READ_HANDLERS } from "./read-registry";

/** Shared chat/bridge boundary: validate inputs before any read or mutation. */
export async function executeAiTool(
  name: string,
  rawInput: unknown,
  invocationId: string,
): Promise<Record<string, unknown> | { done: true }> {
  const definition = getAiToolDefinition(name);
  if (!definition) throw new Error(`Unknown assistant tool: ${name}`);
  if (definition.kind !== "read")
    return executeAiWrite(name, rawInput, invocationId);
  const handler = AI_READ_HANDLERS[name];
  if (!handler) throw new Error(`Unhandled assistant read tool: ${name}`);
  return handler(definition.inputSchema.parse(rawInput ?? {}));
}
