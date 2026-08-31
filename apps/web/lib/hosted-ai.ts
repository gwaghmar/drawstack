import type { AiProvider } from "@/lib/ai-providers";

export type HostedAiConfig = {
  apiKey: string;
  provider: AiProvider;
  model: string;
  baseUrl: string | null;
};

export function getHostedAiConfig(): HostedAiConfig | null {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      apiKey: process.env.OPENROUTER_API_KEY,
      provider: "openai",
      model: process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash-lite",
      baseUrl: "https://openrouter.ai/api/v1",
    };
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      provider: "google",
      model: process.env.GOOGLE_MODEL?.trim() || "gemini-flash-latest",
      baseUrl: null,
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      provider: "openai",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      baseUrl: process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ?? null,
    };
  }

  if (process.env.AI_GATEWAY_KEY) {
    return {
      apiKey: process.env.AI_GATEWAY_KEY,
      provider: "openai",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      baseUrl: process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ?? null,
    };
  }

  return null;
}
