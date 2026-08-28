import { validateEngineV2Document } from "./compiler.ts";
import type { EngineDocument } from "./document.ts";

export function parseSharedEngineV2Document(diagramType: string, source: string): EngineDocument | null {
  if (diagramType !== "engine-v2") return null;
  try {
    const result = validateEngineV2Document(JSON.parse(source) as unknown);
    return result.ok ? result.document : null;
  } catch {
    return null;
  }
}
