import "server-only";

import { tool, type ToolSet } from "ai";

import {
  AI_TOOL_DEFINITIONS,
  FINANCIAL_TOOL_NAMES,
} from "@/lib/ai/definitions";
import { executeAiTool } from "@/lib/ai/dispatch";
import type { MemberContext } from "@/lib/auth/member-context";
import { zurichCivilDate } from "@/lib/ui/zurich-date";

export function buildAssistantTools(): ToolSet {
  const tools: ToolSet = {};
  for (const definition of AI_TOOL_DEFINITIONS) {
    tools[definition.name] = tool({
      description: definition.description,
      inputSchema: definition.inputSchema,
      // Thrown executor errors surface as output-error parts: the member
      // sees a failed call, and the model sees the message to recover.
      execute: (input, { toolCallId }) =>
        executeAiTool(definition.name, input, toolCallId),
    });
  }
  return tools;
}

/** Financial-history tools always pause for the member's explicit approval. */
export function buildToolApproval(): Record<string, "user-approval"> {
  const approval: Record<string, "user-approval"> = {};
  for (const name of FINANCIAL_TOOL_NAMES) {
    approval[name] = "user-approval";
  }
  return approval;
}

export function buildAssistantSystemPrompt(member: MemberContext): string {
  const today = zurichCivilDate();
  return [
    `You are the Household OS assistant for a two-person household in Switzerland. You act on behalf of ${member.displayName} (member id ${member.userId}); every action you take is recorded as theirs.`,
    `Today is ${today} in Europe/Zurich; dates are civil Zurich dates (YYYY-MM-DD) and all money is CHF, expressed as integer centimes.`,
    "The app covers routines (recurring and one-off chores with occurrences you can complete, skip, or reschedule), a weekly meal plan, a shared grocery list with shopping sessions, and shared money (append-only financial history with derived balances).",
    "Ground yourself before acting: use the read tools to find real ids (member, routine, occurrence, area, pet, category, draft, event) — never invent or guess an id, and never ask the user for an id when a read tool can find it from a name.",
    "Prefer acting over describing. When the request is unambiguous, do it and summarise what changed. Ask one short clarifying question only when a wrong guess would be hard to undo.",
    "Financial-history tools (recording expenses, refunds, settlements, opening balance, confirming drafts, corrections) pause for the member's explicit approval before executing; state the amount and effect plainly when proposing one, and if approval is declined, do not retry the tool — ask what to change instead.",
    "Financial history is append-only: never promise to edit or delete a money event; corrections reverse and replace.",
    "Keep replies short and concrete. Use plain sentences, mention amounts as CHF francs (e.g. CHF 12.50) while tools take centimes, and never expose raw ids unless asked.",
  ].join("\n\n");
}
