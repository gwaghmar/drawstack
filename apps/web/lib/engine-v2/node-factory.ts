import type { EngineNode } from "./document.ts";

export type InsertableNodeType = "text" | "metric" | "frame" | "chart" | "graph";

export function createDefaultNode(type: InsertableNodeType, id: string): EngineNode {
  if (type === "text") return { id, name: "Text", type, content: "New text", variant: "heading" };
  if (type === "metric") return { id, name: "Metric", type, label: "Metric label", value: "42", detail: "Add context", tone: "neutral" };
  if (type === "frame") return {
    id,
    name: "Frame",
    type,
    layout: { mode: "flex", direction: "column", gap: 12, padding: 20 },
    style: { background: "#FFFFFF", borderColor: "#D7DBD2", borderWidth: 1, borderRadius: 14, minHeight: 120 },
    children: [],
  };
  if (type === "chart") return {
    id,
    name: "Chart",
    type,
    title: "New chart",
    chartType: "bar",
    data: [{ label: "A", value: 24 }, { label: "B", value: 42 }, { label: "C", value: 31 }],
  };
  return {
    id,
    name: "Graph",
    type,
    title: "New flow",
    graph: {
      name: "New flow",
      direction: "LR",
      nodes: [
        { id: `${id}-start`, label: "Start", kind: "process" },
        { id: `${id}-step`, label: "Next step", kind: "process" },
        { id: `${id}-done`, label: "Done", kind: "process" },
      ],
      edges: [
        { id: `${id}-edge-1`, source: `${id}-start`, target: `${id}-step`, kind: "flow" },
        { id: `${id}-edge-2`, source: `${id}-step`, target: `${id}-done`, kind: "flow" },
      ],
    },
  };
}
