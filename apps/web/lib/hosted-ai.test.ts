import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getHostedAiConfig } from "./hosted-ai.ts";

const KEYS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_BASE_URL",
  "AI_GATEWAY_KEY",
] as const;

const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

function clearHostedAiEnv() {
  for (const key of KEYS) delete process.env[key];
}

afterEach(() => {
  clearHostedAiEnv();
  for (const key of KEYS) {
    const value = original[key];
    if (value !== undefined) process.env[key] = value;
  }
});

describe("getHostedAiConfig", () => {
  it("returns null without a hosted credential", () => {
    clearHostedAiEnv();
    assert.equal(getHostedAiConfig(), null);
  });

  it("prefers OpenRouter and preserves its compatible endpoint", () => {
    clearHostedAiEnv();
    process.env.OPENROUTER_API_KEY = "router-key";
    process.env.OPENROUTER_MODEL = "provider/model";
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-key";

    assert.deepEqual(getHostedAiConfig(), {
      apiKey: "router-key",
      provider: "openai",
      model: "provider/model",
      baseUrl: "https://openrouter.ai/api/v1",
    });
  });

  it("uses the configured Google model", () => {
    clearHostedAiEnv();
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-key";
    process.env.GOOGLE_MODEL = "gemini-custom";

    assert.deepEqual(getHostedAiConfig(), {
      apiKey: "google-key",
      provider: "google",
      model: "gemini-custom",
      baseUrl: null,
    });
  });

  it("normalizes the OpenAI base URL", () => {
    clearHostedAiEnv();
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.OPENAI_BASE_URL = "https://api.openai.com/v1/";

    assert.equal(getHostedAiConfig()?.baseUrl, "https://api.openai.com/v1");
  });
});
