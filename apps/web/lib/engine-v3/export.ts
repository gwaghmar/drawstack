import { createEngineV2PrintHtmlExport, createEngineV2ReactTsxExport, createEngineV2SvgExport, type EngineV2ExportPayload } from "../engine-v2/export.ts";
import type { EngineDocumentV3, Page } from "./document.ts";
import { createEngineV3RenderPlan } from "./render-plan.ts";
import { serializeEngineV3Document } from "./serialization.ts";
import { createEngineV3PageView } from "./view-adapter.ts";

export type EngineV3ExportPayload = EngineV2ExportPayload & { warnings: string[]; pageId?: string };

function stem(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "drawstack";
}

function pageWarning(document: EngineDocumentV3, page: Page): string[] {
  const warnings: string[] = [];
  if (document.assets && Object.keys(document.assets).length) warnings.push("Asset files are referenced but are not embedded in this export.");
  if (page.height === "auto") warnings.push("Auto page height is resolved by the print/layout target.");
  return warnings;
}

function pagePayload(document: EngineDocumentV3, page: Page, kind: "json" | "svg" | "html" | "tsx"): EngineV3ExportPayload {
  const view = createEngineV3PageView(document, page.id);
  const payload = kind === "svg" ? createEngineV2SvgExport(view) : kind === "html" ? createEngineV2PrintHtmlExport(view) : createEngineV2ReactTsxExport(view);
  return { ...payload, filename: `${stem(document.metadata.name)}-${stem(page.name)}.${kind}`, pageId: page.id, warnings: pageWarning(document, page) };
}

export function createEngineV3JsonExport(document: EngineDocumentV3): EngineV3ExportPayload {
  createEngineV3RenderPlan(document);
  return { filename: `${stem(document.metadata.name)}.json`, mimeType: "application/json", contents: serializeEngineV3Document(document), warnings: [] };
}

export function createEngineV3PageExports(document: EngineDocumentV3, kind: "svg" | "html" | "tsx"): EngineV3ExportPayload[] {
  const plan = createEngineV3RenderPlan(document);
  return plan.pages.map((planned) => pagePayload(document, document.pages.find((page) => page.id === planned.id)!, kind));
}
