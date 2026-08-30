import { z } from "zod";

import { executeAiTool } from "@/lib/ai/dispatch";
import { authenticateBridgeRequest } from "@/lib/mcp/bridge-auth";

const callBodySchema = z.object({
  tool: z.string().min(1).max(80),
  input: z.unknown().optional(),
  // Callers that retry must reuse the same key so writes dedupe.
  idempotencyKey: z.string().min(1).max(120),
});

/** Executes one assistant tool as the member behind the bearer grant. */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateBridgeRequest(request);
  if (!auth.ok) {
    return Response.json(
      { error: auth.failure.message },
      { status: auth.failure.status },
    );
  }
  const parsed = callBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "tool and idempotencyKey are required" },
      { status: 400 },
    );
  }
  const { tool, input, idempotencyKey } = parsed.data;
  try {
    const result = await auth.run(() =>
      executeAiTool(tool, input ?? {}, idempotencyKey),
    );
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Tool call failed",
      },
      { status: 400 },
    );
  }
}
