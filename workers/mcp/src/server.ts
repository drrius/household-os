import {
  fromJsonSchema,
  McpServer,
  type JsonSchemaType,
} from "@modelcontextprotocol/server";

import {
  callBridgeTool,
  fetchToolManifest,
  type ToolManifestEntry,
} from "./bridge";

const MANIFEST_TTL_MS = 5 * 60 * 1000;

let cachedManifest: {
  appUrl: string;
  entries: readonly ToolManifestEntry[];
  fetchedAt: number;
} | null = null;

async function loadManifest(
  appUrl: string,
  grantToken: string,
): Promise<readonly ToolManifestEntry[]> {
  const now = Date.now();
  if (
    cachedManifest !== null &&
    cachedManifest.appUrl === appUrl &&
    now - cachedManifest.fetchedAt < MANIFEST_TTL_MS
  ) {
    return cachedManifest.entries;
  }
  const entries = await fetchToolManifest(appUrl, grantToken);
  cachedManifest = { appUrl, entries, fetchedAt: now };
  return entries;
}

/**
 * Builds an MCP server whose tools are exactly the app's manifest. Every
 * call is relayed to the bridge as the member behind the grant token; the
 * worker itself holds no household logic and no Supabase credentials.
 */
export async function buildHouseholdMcpServer(
  appUrl: string,
  grantToken: string,
): Promise<McpServer> {
  const server = new McpServer({
    name: "household-os",
    version: "1.0.0",
  });
  const entries = await loadManifest(appUrl, grantToken);

  for (const entry of entries) {
    server.registerTool(
      entry.name,
      {
        description: entry.description,
        inputSchema: fromJsonSchema(entry.inputSchema as JsonSchemaType),
        annotations: {
          readOnlyHint: entry.kind === "read",
          destructiveHint: entry.kind === "financial",
        },
      },
      async (args) => {
        const outcome = await callBridgeTool({
          appUrl,
          grantToken,
          tool: entry.name,
          input: args ?? {},
          idempotencyKey: crypto.randomUUID(),
        });
        if (!outcome.ok) {
          return {
            content: [{ type: "text", text: outcome.message }],
            isError: true,
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify(outcome.result, null, 2) },
          ],
        };
      },
    );
  }

  return server;
}
