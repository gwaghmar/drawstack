const MAX_ENGINE_V2_PROMPT_LENGTH = 1000;

export function normalizeEngineV2Prompt(value: string | undefined) {
  const prompt = value?.trim();
  return prompt ? prompt.slice(0, MAX_ENGINE_V2_PROMPT_LENGTH) : undefined;
}
