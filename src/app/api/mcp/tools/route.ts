import { buildAiToolManifest } from "@/lib/ai/manifest";
import { authenticateBridgeRequest } from "@/lib/mcp/bridge-auth";

/** Tool manifest for the MCP worker: names, descriptions, JSON Schemas. */
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateBridgeRequest(request);
  if (!auth.ok) {
    return Response.json(
      { error: auth.failure.message },
      { status: auth.failure.status },
    );
  }
  return Response.json({ tools: buildAiToolManifest() });
}
