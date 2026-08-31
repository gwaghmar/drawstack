import type { AssetRef, EngineDocumentV3 } from "./document.ts";

export type SharedAssetResult = { ok: true; assets: Record<string, AssetRef> } | { ok: false; error: "asset-unavailable" | "asset-not-in-document"; missing: string[] };
export const SHARED_INLINE_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/svg+xml"] as const;

export function referencedEngineV3AssetIds(document: EngineDocumentV3): string[] {
  const referenced = new Set<string>();
  const visit = (nodes: EngineDocumentV3["pages"][number]["root"]["children"]) => nodes.forEach((node) => { if (node.assetRef) referenced.add(node.assetRef); if (node.type === "frame") visit(node.children); });
  document.pages.forEach((page) => { if (page.root.assetRef) referenced.add(page.root.assetRef); visit(page.root.children); });
  return [...referenced].sort();
}

export function isSharedInlineImageMime(mime: string): boolean {
  return (SHARED_INLINE_IMAGE_MIMES as readonly string[]).includes(mime);
}

export function resolveSharedDocumentAssets(document: EngineDocumentV3, available: ReadonlyMap<string, AssetRef>): SharedAssetResult {
  const referenced = new Set(referencedEngineV3AssetIds(document));
  const missing = [...referenced].filter((id) => !document.assets[id] || !available.has(id)).sort();
  if (missing.length) return { ok: false, error: "asset-unavailable", missing };
  const assets: Record<string, AssetRef> = {};
  for (const id of referenced) assets[id] = available.get(id)!;
  return { ok: true, assets };
}

export function portableAssetSource(asset: AssetRef, embeddedSource?: string): string {
  if (embeddedSource?.startsWith("data:")) return embeddedSource;
  if (asset.source.startsWith("data:")) return asset.source;
  throw new Error(`Asset ${asset.sha256} is not embedded; export is not portable`);
}
