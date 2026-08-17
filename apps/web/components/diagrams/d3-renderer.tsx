"use client";

import { useEffect, useRef, useState } from "react";

type D3RendererProps = {
  source: string;
  onChange?: (source: string) => void;
  readOnly?: boolean;
};

type D3Spec = {
  subtype: "force" | "tree" | "chord" | "sunburst" | "sankey";
  title?: string;
  nodes: Array<{ id: string; label: string; group?: number; value?: number; parentId?: string | null }>;
  links?: Array<{ source: string; target: string; value?: number; label?: string }>;
  config?: {
    width?: number;
    height?: number;
    colorScheme?: string;
    chargeStrength?: number;
    linkDistance?: number;
  };
};

export function D3Renderer({ source }: D3RendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;

    let spec: D3Spec;
    try {
      spec = JSON.parse(source);
    } catch {
      setError("Invalid JSON — could not parse D3 spec.");
      return;
    }
    setError(null);

    const { config = {} } = spec;
    const W = config.width ?? 800;
    const H = config.height ?? 600;

    svg.innerHTML = "";
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));

    import("d3").then((d3) => {
      const schemeMap: Record<string, readonly string[]> = {
        tableau10: d3.schemeTableau10 as readonly string[],
        blues: d3.schemeBlues[9] as readonly string[],
        oranges: d3.schemeOranges[9] as readonly string[],
        spectral: d3.schemeSpectral[11] as readonly string[],
      };
      const colorScale = d3.scaleOrdinal(
        schemeMap[config.colorScheme ?? "tableau10"] ?? d3.schemeTableau10
      );

      const root = d3.select(svg);

      if (spec.title) {
        root
          .append("text")
          .attr("x", W / 2)
          .attr("y", 24)
          .attr("text-anchor", "middle")
          .attr("font-size", 16)
          .attr("font-family", "Inter, system-ui, sans-serif")
          .attr("font-weight", "600")
          .attr("fill", "#1e293b")
          .text(spec.title);
      }

      const chartTop = spec.title ? 40 : 0;
      const chartH = H - chartTop;
      const g = root.append("g").attr("transform", `translate(0,${chartTop})`);

      if (spec.subtype === "force") {
        renderForce(d3, g, spec, W, chartH, colorScale);
      } else if (spec.subtype === "tree") {
        renderTree(d3, g, spec, W, chartH, colorScale);
      } else {
        renderForce(d3, g, spec, W, chartH, colorScale);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-white overflow-auto">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-sm text-center">
            <p className="text-red-700 font-medium text-sm">D3 render error</p>
            <p className="text-red-500 text-xs mt-1">{error}</p>
          </div>
        </div>
      )}
      <svg ref={svgRef} style={{ fontFamily: "Inter, system-ui, sans-serif" }} />
    </div>
  );
}

type D3Sel = d3.Selection<SVGGElement, unknown, null, undefined>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D3Any = any;

function renderForce(d3: D3Any, g: D3Sel, spec: D3Spec, W: number, H: number, colorScale: D3Any) {
  const nodes = spec.nodes.map((n) => ({ ...n }));
  const links = (spec.links ?? []).map((l) => ({ ...l }));

  const simulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d: D3Any) => d.id).distance(spec.config?.linkDistance ?? 120))
    .force("charge", d3.forceManyBody().strength(spec.config?.chargeStrength ?? -300))
    .force("center", d3.forceCenter(W / 2, H / 2))
    .force("collision", d3.forceCollide(30));

  const linkSel = g
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", "#cbd5e1")
    .attr("stroke-width", (d: D3Any) => Math.max(1, Math.sqrt(d.value ?? 1)));

  const nodeSel = g
    .append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", (d: D3Any) => 6 + (d.value ?? 10) * 0.4)
    .attr("fill", (d: D3Any) => colorScale(String(d.group ?? d.id)))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  const labelSel = g
    .append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("font-size", 11)
    .attr("fill", "#1e293b")
    .attr("pointer-events", "none")
    .text((d: D3Any) => d.label);

  simulation.on("tick", () => {
    linkSel
      .attr("x1", (d: D3Any) => d.source.x)
      .attr("y1", (d: D3Any) => d.source.y)
      .attr("x2", (d: D3Any) => d.target.x)
      .attr("y2", (d: D3Any) => d.target.y);
    nodeSel.attr("cx", (d: D3Any) => d.x).attr("cy", (d: D3Any) => d.y);
    labelSel
      .attr("x", (d: D3Any) => d.x)
      .attr("y", (d: D3Any) => d.y + (6 + (d.value ?? 10) * 0.4) + 12);
  });
}

function renderTree(d3: D3Any, g: D3Sel, spec: D3Spec, W: number, H: number, colorScale: D3Any) {
  const nodeMap = new Map(spec.nodes.map((n) => [n.id, { ...n, children: [] as D3Any[] }]));
  let root: D3Any = null;
  nodeMap.forEach((n) => {
    if (n.parentId == null) {
      root = n;
    } else {
      const parent = nodeMap.get(n.parentId);
      if (parent) parent.children.push(n);
    }
  });
  if (!root) return;

  const hierarchy = d3.hierarchy(root);
  const treeLayout = (d3 as any).tree().size([W - 80, H - 80]);
  treeLayout(hierarchy);

  g.attr("transform", `translate(40, 40)`);

  g.append("g")
    .selectAll("path")
    .data(hierarchy.links())
    .join("path")
    .attr("fill", "none")
    .attr("stroke", "#cbd5e1")
    .attr("stroke-width", 1.5)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .attr("d", (d3 as any).linkVertical().x((d: D3Any) => d.x).y((d: D3Any) => d.y) as string);

  const node = g
    .append("g")
    .selectAll("g")
    .data(hierarchy.descendants())
    .join("g")
    .attr("transform", (d: D3Any) => `translate(${d.x},${d.y})`);

  node
    .append("circle")
    .attr("r", 8)
    .attr("fill", (d: D3Any) => colorScale(String(d.depth)))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  node
    .append("text")
    .attr("dy", "0.35em")
    .attr("x", (d: D3Any) => (d.children ? -12 : 12))
    .attr("text-anchor", (d: D3Any) => (d.children ? "end" : "start"))
    .attr("font-size", 12)
    .attr("fill", "#1e293b")
    .text((d: D3Any) => d.data.label);
}
