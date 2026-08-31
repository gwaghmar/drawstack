import { chartSvg, createEngineV2PrintHtmlExport, createEngineV2ReactTsxExport, createEngineV2SvgExport, graphSvg, type EngineV2ExportPayload } from "../engine-v2/export.ts";
import type { EngineDocumentV3, EngineNode, Page } from "./document.ts";
import { createEngineV3RenderPlan } from "./render-plan.ts";
import { serializeEngineV3Document } from "./serialization.ts";
import { createEngineV3PageView } from "./view-adapter.ts";
import { portableAssetSource } from "./asset-sharing.ts";

export type EngineV3ExportPayload = EngineV2ExportPayload & { warnings: string[]; pageId?: string };

export async function inlineEngineV3Assets(
  document: EngineDocumentV3,
  read: (sha256: string) => Promise<string | null>,
): Promise<EngineDocumentV3> {
  const next = structuredClone(document);
  const referenced = new Set<string>();
  const visit = (nodes: EngineDocumentV3["pages"][number]["root"]["children"]) => nodes.forEach((node) => { if (node.assetRef) referenced.add(node.assetRef); if (node.type === "frame") visit(node.children); });
  next.pages.forEach((page) => { if (page.root.assetRef) referenced.add(page.root.assetRef); visit(page.root.children); });
  for (const id of referenced) {
    const asset = next.assets[id];
    if (!asset) throw new Error(`Asset ${id} is unavailable for portable export`);
    const embedded = await read(id);
    if (!embedded) throw new Error(`Asset ${id} is unavailable for portable export`);
    asset.source = portableAssetSource(asset, embedded);
  }
  return next;
}

function stem(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "drawstack";
}

function pageWarning(document: EngineDocumentV3, page: Page): string[] {
  const warnings: string[] = [];
  const referenced = new Set<string>();
  const visit = (nodes: EngineDocumentV3["pages"][number]["root"]["children"]) => nodes.forEach((node) => { if (node.assetRef) referenced.add(node.assetRef); if (node.type === "frame") visit(node.children); });
  visit(page.root.children);
  if ([...referenced].some((id) => !document.assets[id]?.source.startsWith("data:"))) warnings.push("Asset files are referenced but are not embedded in this export.");
  if (page.height === "auto") warnings.push("Auto page height is resolved by the print/layout target.");
  return warnings;
}

function standaloneSvg(document: EngineDocumentV3, page: Page): string {
  const plan = createEngineV3RenderPlan(document);
  const planned = plan.pages.find((candidate) => candidate.id === page.id)!;
  const view = createEngineV3PageView(document, page.id);
  const records = planned.records;
  const dimensions = (record: typeof records[number], availableWidth = 320) => ({
    width: typeof record.style?.width === "number" ? record.style.width : typeof record.style?.width === "string" && /^\d+(?:\.\d+)?%$/.test(record.style.width) ? availableWidth * Number.parseFloat(record.style.width) / 100 : record.type === "text" ? 280 : 320,
    height: typeof record.style?.minHeight === "number" ? record.style.minHeight : record.type === "text" ? 64 : record.type === "metric" ? 129 : record.type === "chart" ? 330 : record.type === "graph" ? 280 : record.type === "path" ? 180 : 180,
  });
  const positions = new Map<string, { x: number; y: number }>();
  const sizes = new Map<string, { width: number; height: number }>();
  const recordById = new Map(records.map((record) => [record.id, record]));
  const layoutChildren = (parent: typeof records[number], parentX: number, parentY: number) => {
    const layout = (parent.node as Extract<EngineNode, { type: "frame" }>).layout;
    const padding = layout.padding ?? 0;
    let cursorX = parentX + padding;
    let cursorY = parentY + padding;
    const columns = Math.max(1, layout.columns ?? 1);
    childrenOf(parent.id).forEach((child, index) => {
      const childTransform = child.node.transform;
      const explicit = childTransform?.x !== undefined || childTransform?.y !== undefined;
      const size = dimensions(child, dimensions(parent).width - padding * 2);
      sizes.set(child.id, size);
      const x = explicit ? child.transform.x : layout.mode === "grid" ? cursorX + (index % columns) * (size.width + layout.gap) : cursorX;
      const y = explicit ? child.transform.y : layout.mode === "grid" ? cursorY + Math.floor(index / columns) * (size.height + layout.gap) : cursorY;
      positions.set(child.id, { x, y });
      if (!explicit) {
        if (layout.mode === "grid") {
          if ((index + 1) % columns === 0) cursorY = y + size.height + layout.gap;
        } else if ((layout.direction ?? "row") === "row") cursorX = x + size.width + layout.gap;
        else cursorY = y + size.height + layout.gap;
      }
      if (child.type === "frame") layoutChildren(child, x, y);
    });
  };
  const childrenOf = (parentId: string) => records.filter((record) => record.parentId === parentId);
  const root = recordById.get(page.root.id);
  if (root) { positions.set(root.id, { x: 0, y: 0 }); sizes.set(root.id, { width: planned.width, height: planned.height === "auto" ? 720 : planned.height }); layoutChildren(root, 0, 0); }
  const color = (value: unknown, fallback: string) => typeof value === "string" && (value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl")) ? value : fallback;
  const fill = (record: typeof records[number]) => color(record.style?.background, "transparent");
  const stroke = (record: typeof records[number]) => color(record.style?.borderColor, "#D7DBD2");
  const textColor = (record: typeof records[number]) => color(record.style?.color, "#15171A");
  const text = (value: string, x: number, y: number, size: number, colorValue: string, weight = 400) => `<text x="${x}" y="${y}" font-family="Inter,ui-sans-serif,system-ui,sans-serif" font-size="${size}" font-weight="${weight}" fill="${colorValue}">${value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`;
  const markup = records.filter((record) => record.id !== page.root.id && record.visible).map((record) => {
    const source = record.node as unknown as Record<string, unknown>;
    const { width, height } = sizes.get(record.id) ?? dimensions(record, record.parentId ? dimensions(recordById.get(record.parentId)!).width : planned.width);
    const position = positions.get(record.id) ?? { x: record.transform.x, y: record.transform.y };
    const x = position.x; const y = position.y;
    const transform = `translate(${x} ${y}) rotate(${record.transform.rotation} ${width / 2} ${height / 2}) scale(${record.transform.scaleX} ${record.transform.scaleY})`;
    const opacity = record.opacity < 1 ? ` opacity="${record.opacity}"` : "";
    if (record.type === "frame") return `<g data-node-id="${record.id}" transform="${transform}"${opacity}><rect width="${width}" height="${height}" rx="${Number(record.style?.borderRadius ?? 0)}" fill="${fill(record)}" stroke="${stroke(record)}" stroke-width="${Number(record.style?.borderWidth ?? 0)}"/></g>`;
    if (record.type === "text") {
      const variant = String(source.variant ?? "body");
      const size = variant === "display" ? 58 : variant === "heading" ? 24 : variant === "caption" ? 11 : 15;
      return `<g data-node-id="${record.id}" transform="${transform}"${opacity}>${text(String(source.content ?? ""), 0, size, size, textColor(record), variant === "body" ? 400 : 650)}</g>`;
    }
    if (record.type === "metric") return `<g data-node-id="${record.id}" transform="${transform}"${opacity}><rect width="${width}" height="${height}" rx="${Number(record.style?.borderRadius ?? 14)}" fill="${fill(record)}" stroke="${stroke(record)}" stroke-width="${Number(record.style?.borderWidth ?? 1)}"/>${text(String(source.label ?? ""), 20, 28, 10, "#667067", 600)}${text(String(source.value ?? ""), 20, 70, 32, source.tone === "warning" ? "#FF5D2E" : "#3157F6", 650)}${text(String(source.detail ?? ""), 20, 102, 12, "#667067")}</g>`;
    if (record.type === "image") return `<g data-node-id="${record.id}" transform="${transform}"${opacity}><image href="${record.asset?.ref.source ?? String(source.src ?? "")}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/></g>`;
    if (record.type === "path") {
      const points = Array.isArray(source.points) ? source.points.filter((point): point is { x: number; y: number } => Boolean(point && typeof point === "object" && Number.isFinite((point as { x?: unknown }).x) && Number.isFinite((point as { y?: unknown }).y))).map((point) => `${point.x},${point.y}`).join(" ") : "";
      return `<g data-node-id="${record.id}" transform="${transform}"${opacity}><polyline points="${points}" fill="none" stroke="${textColor(record)}" stroke-width="${Number(record.style?.borderWidth ?? 3)}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    }
    const graphic = record.type === "graph" ? graphSvg(record.node as never, view.tokens as never) : chartSvg(record.node as never, view.tokens as never);
    return `<g data-node-id="${record.id}" transform="${transform}"${opacity}><rect width="${width}" height="${height}" rx="14" fill="${fill(record)}" stroke="${stroke(record)}"/><text x="20" y="28" font-family="Inter,ui-sans-serif,system-ui,sans-serif" font-size="15" font-weight="650" fill="#15171A">${String(source.title ?? "").replace(/[&<>]/g, "")}</text><g transform="translate(0 40)">${graphic.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g></g>`;
  }).join("");
  const height = planned.height === "auto" ? 720 : planned.height;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${planned.width}" height="${height}" viewBox="0 0 ${planned.width} ${height}" role="img" aria-label="${page.name.replace(/[&<>]/g, "")}"><title>${page.name.replace(/[&<>]/g, "")}</title><rect width="100%" height="100%" fill="${planned.background}"/>${markup}</svg>\n`;
}

function pagePayload(document: EngineDocumentV3, page: Page, kind: "json" | "svg" | "html" | "tsx"): EngineV3ExportPayload {
  const view = createEngineV3PageView(document, page.id);
  const payload = kind === "svg" ? { ...createEngineV2SvgExport(view), contents: standaloneSvg(document, page) } : kind === "html" ? createEngineV2PrintHtmlExport(view) : createEngineV2ReactTsxExport(view);
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
