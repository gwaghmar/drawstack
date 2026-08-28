import type { Page } from "@playwright/test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

export type SvgGeometry = {
  id: string;
  viewBox: { width: number; height: number };
  bounds: { x: number; y: number; width: number; height: number };
  primitiveCount: number;
  labels: string;
  title: string;
};

export type NodeLayout = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  display: string;
  flexDirection: string;
  gridTemplateColumns: string;
  text: string;
};

export async function readChartGeometry(page: Page, rootSelector: string): Promise<SvgGeometry[]> {
  return page.locator(`${rootSelector} [data-node-id^="chart-"]`).evaluateAll((nodes) => nodes.flatMap((node) => {
    const svg = node.querySelector<SVGSVGElement>("svg");
    if (!svg) return [];
    const primitives = [...svg.querySelectorAll<SVGGraphicsElement>("path,line,rect,circle,polygon,polyline")];
    const boxes = primitives.map((primitive) => {
      try {
        return primitive.getBBox();
      } catch {
        return null;
      }
    }).filter((box): box is DOMRect => box !== null && [box.x, box.y, box.width, box.height].every(Number.isFinite));
    const minX = boxes.length ? Math.min(...boxes.map((box) => box.x)) : 0;
    const minY = boxes.length ? Math.min(...boxes.map((box) => box.y)) : 0;
    const maxX = boxes.length ? Math.max(...boxes.map((box) => box.x + box.width)) : 0;
    const maxY = boxes.length ? Math.max(...boxes.map((box) => box.y + box.height)) : 0;
    const round = (value: number) => Math.round(value * 10) / 10;
    return [{
      id: node.getAttribute("data-node-id") ?? "",
      viewBox: { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height },
      bounds: { x: round(minX), y: round(minY), width: round(maxX - minX), height: round(maxY - minY) },
      primitiveCount: primitives.length,
      labels: [...svg.querySelectorAll("text")].map((text) => text.textContent?.trim() ?? "").filter(Boolean).join(" | "),
      title: svg.getAttribute("aria-label") ?? svg.querySelector(":scope > title")?.textContent?.trim() ?? "",
    }];
  }));
}

export function chartSvgFromGeneratedTsx(source: string): string[] {
  return [...source.matchAll(/<svg className="engine-chart"[\s\S]*?<\/svg>/g)].map((match) => match[0]
    .replace(/\bclassName=/g, "class=")
    .replace(/\bfillOpacity=/g, "fill-opacity=")
    .replace(/\bfontSize=/g, "font-size=")
    .replace(/\bfontWeight=/g, "font-weight=")
    .replace(/\bmarkerEnd=/g, "marker-end=")
    .replace(/\bstrokeDasharray=/g, "stroke-dasharray=")
    .replace(/\bstrokeDashoffset=/g, "stroke-dashoffset=")
    .replace(/\bstrokeLinecap=/g, "stroke-linecap=")
    .replace(/\bstrokeLinejoin=/g, "stroke-linejoin=")
    .replace(/\bstrokeWidth=/g, "stroke-width=")
    .replace(/\btextAnchor=/g, "text-anchor="));
}

export async function readNodeLayouts(page: Page, ids: string[], rootId = "root"): Promise<NodeLayout[]> {
  return page.locator(`[data-node-id="${rootId}"]`).first().evaluate((root, requestedIds) => {
    const rootBounds = root.getBoundingClientRect();
    const round = (value: number) => Math.round(value * 10) / 10;
    return requestedIds.map((id) => {
      const node = root.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`) ?? (root.getAttribute("data-node-id") === id ? root as HTMLElement : null);
      if (!node) throw new Error(`Missing node ${id}`);
      const bounds = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        id,
        x: round(bounds.left - rootBounds.left),
        y: round(bounds.top - rootBounds.top),
        width: round(bounds.width),
        height: round(bounds.height),
        display: style.display,
        flexDirection: style.flexDirection,
        gridTemplateColumns: style.gridTemplateColumns,
        text: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
      };
    });
  }, ids);
}

export async function readSvgGeometryForNode(page: Page, id: string): Promise<SvgGeometry> {
  const values = await page.locator(`[data-node-id="${id}"]`).evaluateAll((nodes) => nodes.slice(0, 1).flatMap((node) => {
    const svg = node.querySelector<SVGSVGElement>("svg");
    if (!svg) return [];
    const primitives = [...svg.querySelectorAll<SVGGraphicsElement>("path,line,rect,circle,ellipse,polygon,polyline")];
    const boxes = primitives.map((primitive) => primitive.getBBox());
    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));
    const round = (value: number) => Math.round(value * 10) / 10;
    return [{
      id: node.getAttribute("data-node-id") ?? "",
      viewBox: { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height },
      bounds: { x: round(minX), y: round(minY), width: round(maxX - minX), height: round(maxY - minY) },
      primitiveCount: primitives.length,
      labels: [...svg.querySelectorAll("text")].map((text) => text.textContent?.trim() ?? "").filter(Boolean).join(" | "),
      title: svg.getAttribute("aria-label") ?? svg.querySelector(":scope > title")?.textContent?.trim() ?? "",
    }];
  }));
  if (!values[0]) throw new Error(`Missing SVG for ${id}`);
  return values[0];
}

export function renderGeneratedTsx(source: string): string {
  const requireFromWeb = createRequire(`${process.cwd()}/apps/web/package.json`);
  const typescript = requireFromWeb("typescript");
  const React = requireFromWeb("react");
  const { renderToStaticMarkup } = requireFromWeb("react-dom/server");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      jsx: typescript.JsxEmit.React,
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2020,
    },
    reportDiagnostics: true,
    fileName: "drawstack-export.tsx",
  });
  const errors = (compiled.diagnostics ?? []).filter((diagnostic: { category: number }) => diagnostic.category === typescript.DiagnosticCategory.Error);
  if (errors.length) throw new Error("Generated TSX did not compile");
  const generatedModule = { exports: {} as { default?: () => unknown } };
  new Function("exports", "module", "require", "React", compiled.outputText)(generatedModule.exports, generatedModule, requireFromWeb, React);
  if (!generatedModule.exports.default) throw new Error("Generated TSX has no default component");
  return renderToStaticMarkup(React.createElement(generatedModule.exports.default));
}

export async function readPngDimensions(path: string): Promise<{ width: number; height: number }> {
  const bytes = await readFile(path);
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") throw new Error("Download is not a PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
