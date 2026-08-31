import type { EngineDocument, EngineNode as EngineV2Node } from "../engine-v2/document.ts";
import type { EngineDocumentV3 } from "./document.ts";
import { createEngineV3RenderPlan, type ResolvedRenderRecord } from "./render-plan.ts";

function style(record: ResolvedRenderRecord, parent: ResolvedRenderRecord | undefined): Record<string, unknown> {
  const next = { ...record.style };
  const { x, y, rotation } = record.transform;
  const localX = x - (parent?.transform.x ?? 0);
  const localY = y - (parent?.transform.y ?? 0);
  if (localX || localY) { next.position = "absolute"; next.x = localX; next.y = localY; }
  if (record.opacity !== 1) next.opacity = record.opacity;
  return next;
}

function nodeFromRecord(record: ResolvedRenderRecord, parent: ResolvedRenderRecord | undefined, children: EngineV2Node[]): EngineV2Node {
  const { transform: _transform, opacity: _opacity, blendMode: _blendMode, styleRef: _styleRef, componentRef: _componentRef, instanceOverrides: _instanceOverrides, assetRef: _assetRef, ...source } = record.node;
  const sourceRecord = source as Record<string, unknown>;
  const base = { ...source, id: record.id, name: record.name, style: style(record, parent), visible: record.visible, locked: record.locked, rotation: record.transform.rotation };
  if (record.type === "image") return { ...base, type: "image", src: record.asset?.ref.source ?? String(sourceRecord["src"] ?? ""), alt: String(sourceRecord["alt"] ?? record.name) } as EngineV2Node;
  if (record.type === "frame") return { ...base, type: "frame", children } as EngineV2Node;
  return base as EngineV2Node;
}

export function createEngineV3PageView(document: EngineDocumentV3, pageId: string): EngineDocument {
  const plan = createEngineV3RenderPlan(document);
  const page = plan.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`Unknown Engine v3 page: ${pageId}`);
  const byParent = new Map<string | null, ResolvedRenderRecord[]>();
  for (const record of page.records) {
    const records = byParent.get(record.parentId) ?? [];
    records.push(record);
    byParent.set(record.parentId, records);
  }
  const recordsById = new Map(page.records.map((record) => [record.id, record]));
  const build = (record: ResolvedRenderRecord): EngineV2Node => nodeFromRecord(record, record.parentId ? recordsById.get(record.parentId) : undefined, (byParent.get(record.id) ?? []).map(build));
  const roots = byParent.get(null) ?? [];
  const colors: Record<string, string> = {};
  for (const [name, token] of Object.entries(plan.tokens.colors)) if (typeof token.value === "string") colors[name] = token.value;
  const spacing: Record<string, number> = {};
  for (const [name, token] of Object.entries(plan.tokens.spacing)) if (typeof token.value === "number") spacing[name] = token.value;
  const radii: Record<string, number> = {};
  for (const [name, token] of Object.entries(plan.tokens.radii)) if (typeof token.value === "number") radii[name] = token.value;
  return { version: 2, engine: "dom-css", name: page.name, artboard: { width: page.width, minHeight: page.height === "auto" ? 240 : page.height, background: page.background }, tokens: { colors, spacing, radii }, children: roots.map(build) };
}
