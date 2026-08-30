import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { z } from "zod";

const aiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  HOUSEHOLD_AI_MODEL: z.string().min(1).default("gpt-5.1"),
});

/**
 * The one place the assistant picks a model. Swapping providers means
 * changing this factory (or pointing HOUSEHOLD_AI_MODEL elsewhere); nothing
 * outside this module knows which vendor is behind the assistant.
 */
export function resolveAssistantModel(): LanguageModel {
  const env = aiEnvSchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    HOUSEHOLD_AI_MODEL: process.env.HOUSEHOLD_AI_MODEL,
  });
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai(env.HOUSEHOLD_AI_MODEL);
}

function hasEnv(name: "OPENAI_API_KEY" | "TOOL_APPROVAL_SECRET"): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0;
}

/**
 * Both secrets are required: the model key to run at all, and the approval
 * secret so financial approvals replayed by the browser are always signed.
 */
export function isAssistantConfigured(): boolean {
  return hasEnv("OPENAI_API_KEY") && hasEnv("TOOL_APPROVAL_SECRET");
}
