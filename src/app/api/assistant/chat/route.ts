import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from "ai";

import { getMemberContext } from "@/lib/auth/member-context";
import { isAssistantConfigured, resolveAssistantModel } from "@/lib/ai/model";
import {
  buildAssistantSystemPrompt,
  buildAssistantTools,
  buildToolApproval,
} from "@/lib/ai/toolkit";

export async function POST(request: Request): Promise<Response> {
  const member = await getMemberContext();
  if (member === null) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isAssistantConfigured()) {
    return Response.json(
      { error: "The assistant is not configured (missing OPENAI_API_KEY)." },
      { status: 503 },
    );
  }

  const body: unknown = await request.json();
  const rawMessages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return Response.json({ error: "messages are required" }, { status: 400 });
  }
  // The conversation lives in the browser; cap what one request may replay.
  if (rawMessages.length > 200) {
    return Response.json({ error: "conversation too long" }, { status: 413 });
  }
  const messages = await validateUIMessages({ messages: rawMessages });

  const result = streamText({
    model: resolveAssistantModel(),
    system: buildAssistantSystemPrompt(member),
    messages: await convertToModelMessages(messages),
    tools: buildAssistantTools(),
    toolApproval: buildToolApproval(),
    experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET,
    stopWhen: isStepCount(12),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
