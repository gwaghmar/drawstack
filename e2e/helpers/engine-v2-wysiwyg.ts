import type { Page } from "@playwright/test";

export type SvgGeometry = {
  id: string;
  viewBox: { width: number; height: number };
  bounds: { x: number; y: number; width: number; height: number };
  primitiveCount: number;
  labels: string;
  title: string;
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
