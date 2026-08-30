import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  assistantConfigHint,
  isAssistantConfigured,
  resolveAssistantModel,
} from "@/lib/ai/model";

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubBaseSecrets() {
  vi.stubEnv("TOOL_APPROVAL_SECRET", "secret");
}

/** The factory always builds a model object, never a bare gateway id. */
function asModelObject(model: ReturnType<typeof resolveAssistantModel>) {
  if (typeof model === "string") {
    throw new Error("expected a model object, got a model id string");
  }
  return model;
}

describe("provider selection", () => {
  it("defaults to the OpenAI adapter", () => {
    stubBaseSecrets();
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("HOUSEHOLD_AI_PROVIDER", "");
    const model = asModelObject(resolveAssistantModel());
    expect(model.provider).toContain("openai");
    expect(model.modelId).toBe("gpt-5.1");
    expect(isAssistantConfigured()).toBe(true);
  });

  it("builds an OpenCode Zen chat model when selected", () => {
    stubBaseSecrets();
    vi.stubEnv("HOUSEHOLD_AI_PROVIDER", "opencode");
    vi.stubEnv("OPENCODE_API_KEY", "oc-test");
    vi.stubEnv("HOUSEHOLD_AI_MODEL", "grok-code");
    const model = asModelObject(resolveAssistantModel());
    expect(model.provider).toContain("opencode");
    expect(model.modelId).toBe("grok-code");
    expect(isAssistantConfigured()).toBe(true);
  });

  it("rejects unknown providers", () => {
    vi.stubEnv("HOUSEHOLD_AI_PROVIDER", "mystery");
    expect(() => resolveAssistantModel()).toThrow();
  });
});

describe("configuration gating", () => {
  it("requires the approval secret regardless of provider", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("TOOL_APPROVAL_SECRET", "");
    expect(isAssistantConfigured()).toBe(false);
  });

  it("requires an explicit model for opencode", () => {
    stubBaseSecrets();
    vi.stubEnv("HOUSEHOLD_AI_PROVIDER", "opencode");
    vi.stubEnv("OPENCODE_API_KEY", "oc-test");
    vi.stubEnv("HOUSEHOLD_AI_MODEL", "");
    expect(isAssistantConfigured()).toBe(false);
    expect(assistantConfigHint()).toContain("OPENCODE_API_KEY");
  });
});
