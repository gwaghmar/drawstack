import { validateEngineV2Document } from "./engine-v2/compiler.ts";
import type { EngineDocument } from "./engine-v2/document.ts";
import { validateEngineV3Document } from "./engine-v3/compiler.ts";
import type { EngineDocumentV3 } from "./engine-v3/document.ts";
import { serializeEngineV3Document } from "./engine-v3/serialization.ts";

export type ParsedEngineSource =
  | { version: 2; document: EngineDocument; source: string }
  | { version: 3; document: EngineDocumentV3; source: string };

export function parseEngineSource(source: string): ParsedEngineSource {
  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch {
    throw new Error("Document is not valid JSON");
  }
  if (input && typeof input === "object" && !Array.isArray(input) && (input as { version?: unknown }).version === 3) {
    const result = validateEngineV3Document(input);
    if (!result.ok) throw new Error(result.issues[0]?.message || "Invalid Engine v3 document");
    return { version: 3, document: result.document, source: serializeEngineV3Document(result.document) };
  }
  const result = validateEngineV2Document(input);
  if (!result.ok) throw new Error(result.issues[0]?.message || "Invalid Engine v2 document");
  return { version: 2, document: result.document, source: JSON.stringify(result.document) };
}
