import type { EngineDocumentV3 } from "./document.ts";
import { parseEngineSource } from "../engine-document-source.ts";

export function parseSharedEngineV3Document(diagramType: string, source: string): EngineDocumentV3 | null {
  if (diagramType !== "engine-v2") return null;
  try {
    const result = parseEngineSource(source);
    return result.version === 3 ? result.document : null;
  } catch {
    return null;
  }
}
