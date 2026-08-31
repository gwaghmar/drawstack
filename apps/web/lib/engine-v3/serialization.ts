import type { EngineDocument } from "../engine-v2/document.ts";
import { validateEngineV2Document } from "../engine-v2/compiler.ts";
import { validateEngineV3Document, type EngineV3Issue } from "./compiler.ts";
import type { EngineDocumentV3 } from "./document.ts";
import { migrateV2ToV3, type MigrationAudit } from "./migration.ts";

export type EngineV3SourceVersion = "v2" | "v3" | "legacy-freeform" | "unknown";
export type EngineV3ParseResult =
  | { ok: true; version: "v3" | "v2"; sourceVersion: "v2" | "v3"; document: EngineDocumentV3; audit?: MigrationAudit; canonicalSource: string }
  | { ok: false; version: EngineV3SourceVersion; issues: EngineV3Issue[] };

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, ordered((value as Record<string, unknown>)[key])]));
}

export function serializeEngineV3Document(document: EngineDocumentV3): string {
  return JSON.stringify(ordered(document));
}

function issue(path: string, message: string): EngineV3Issue[] {
  return [{ path, message }];
}

export function parseEngineV3Source(source: unknown): EngineV3ParseResult {
  if (typeof source !== "string") return { ok: false, version: "unknown", issues: issue("$", "Expected JSON source text") };
  let input: unknown;
  try { input = JSON.parse(source); } catch { return { ok: false, version: "unknown", issues: issue("$", "Malformed JSON") }; }
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, version: "unknown", issues: issue("$", "Expected a JSON document object") };
  const record = input as Record<string, unknown>;
  if (record.engine === "freeform" || record.diagramType === "freeform" || record.type === "freeform") return { ok: false, version: "legacy-freeform", issues: issue("$", "Legacy freeform documents require the legacy editor") };
  if (record.version === 3) {
    const checked = validateEngineV3Document(input);
    return checked.ok ? { ok: true, version: "v3", sourceVersion: "v3", document: checked.document, canonicalSource: serializeEngineV3Document(checked.document) } : { ok: false, version: "v3", issues: checked.issues };
  }
  if (record.version === 2 && record.engine === "dom-css") {
    const v2 = validateEngineV2Document(input);
    if (!v2.ok) return { ok: false, version: "v2", issues: v2.issues };
    const migrated = migrateV2ToV3(v2.document as EngineDocument);
    const checked = validateEngineV3Document(migrated.document);
    return checked.ok ? { ok: true, version: "v2", sourceVersion: "v2", document: checked.document, audit: migrated.audit, canonicalSource: serializeEngineV3Document(checked.document) } : { ok: false, version: "v2", issues: checked.issues };
  }
  return { ok: false, version: "unknown", issues: issue("version", "Unsupported document version or engine") };
}
