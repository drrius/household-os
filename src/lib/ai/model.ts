import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { z } from "zod";

const providerSchema = z.enum(["openai", "opencode"]).default("openai");

const openAiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  HOUSEHOLD_AI_MODEL: z.string().min(1).default("gpt-5.1"),
});

const openCodeEnvSchema = z.object({
  OPENCODE_API_KEY: z.string().min(1),
  OPENCODE_BASE_URL: z.string().min(1).default("https://opencode.ai/zen/v1"),
  // No default: the Zen catalog shifts, so the model must be named.
  HOUSEHOLD_AI_MODEL: z.string().min(1),
});

function resolveProvider(): z.infer<typeof providerSchema> {
  return providerSchema.parse(process.env.HOUSEHOLD_AI_PROVIDER || undefined);
}

/**
 * The one place the assistant picks a model. HOUSEHOLD_AI_PROVIDER selects
 * the adapter (openai by default; opencode for the OpenCode Zen gateway,
 * which speaks OpenAI-compatible chat completions), and HOUSEHOLD_AI_MODEL
 * names the model. Nothing outside this module knows which vendor is
 * behind the assistant.
 */
export function resolveAssistantModel(): LanguageModel {
  if (resolveProvider() === "opencode") {
    const env = openCodeEnvSchema.parse({
      OPENCODE_API_KEY: process.env.OPENCODE_API_KEY,
      OPENCODE_BASE_URL: process.env.OPENCODE_BASE_URL,
      HOUSEHOLD_AI_MODEL: process.env.HOUSEHOLD_AI_MODEL,
    });
    const opencode = createOpenAICompatible({
      name: "opencode",
      baseURL: env.OPENCODE_BASE_URL,
      apiKey: env.OPENCODE_API_KEY,
    });
    return opencode.chatModel(env.HOUSEHOLD_AI_MODEL);
  }
  const env = openAiEnvSchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    HOUSEHOLD_AI_MODEL: process.env.HOUSEHOLD_AI_MODEL,
  });
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai(env.HOUSEHOLD_AI_MODEL);
}

function hasEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0;
}

/**
 * The active provider's key and the approval secret are both required: the
 * key to run at all, and the secret so financial approvals replayed by the
 * browser are always signed.
 */
export function isAssistantConfigured(): boolean {
  if (!hasEnv("TOOL_APPROVAL_SECRET")) {
    return false;
  }
  if (resolveProvider() === "opencode") {
    return hasEnv("OPENCODE_API_KEY") && hasEnv("HOUSEHOLD_AI_MODEL");
  }
  return hasEnv("OPENAI_API_KEY");
}

/** What a 503 should tell the operator to set, for the active provider. */
export function assistantConfigHint(): string {
  return resolveProvider() === "opencode"
    ? "set OPENCODE_API_KEY, HOUSEHOLD_AI_MODEL, and TOOL_APPROVAL_SECRET"
    : "set OPENAI_API_KEY and TOOL_APPROVAL_SECRET";
}
