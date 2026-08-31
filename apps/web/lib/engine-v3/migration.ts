import type { EngineDocument } from "../engine-v2/document.ts";
import type { EngineDocumentV3, EngineFrameNode } from "./document.ts";
import { typedTokens } from "./document.ts";

export type MigrationAudit = { from: 2; to: 3; preservedNodeIds: string[]; warnings: string[] };
export type MigrationResult = { document: EngineDocumentV3; audit: MigrationAudit };

function collectIds(nodes: EngineDocument["children"], ids: string[] = []): string[] {
  for (const node of nodes) {
    ids.push(node.id);
    if (node.type === "frame") collectIds(node.children, ids);
  }
  return ids;
}

export function migrateV2ToV3(source: EngineDocument, now = "1970-01-01T00:00:00.000Z"): MigrationResult {
  const ids = collectIds(source.children);
  if (!source.children.length) throw new Error("Engine v2 document must contain at least one node");
  const onlyRoot = source.children.length === 1 ? source.children[0] : null;
  const root: EngineFrameNode = onlyRoot?.type === "frame"
    ? onlyRoot
    : {
      id: "v2-migration-root",
      name: source.name,
      type: "frame",
      layout: { mode: "flex", direction: "column", gap: 0, padding: 0 },
      children: source.children,
    };
  const document: EngineDocumentV3 = {
    version: 3,
    engine: "dom-css",
    metadata: { id: `v2-${root.id}`, name: source.name, createdAt: now, updatedAt: now },
    tokens: typedTokens(source.tokens),
    assets: {},
    components: {},
    pages: [{ id: `page-${root.id}`, name: source.name, width: source.artboard.width, height: source.artboard.minHeight, background: source.artboard.background, root }],
  };
  return { document, audit: { from: 2, to: 3, preservedNodeIds: ids, warnings: onlyRoot?.type === "frame" ? [] : ["Top-level nodes were wrapped in a migration frame."] } };
}
