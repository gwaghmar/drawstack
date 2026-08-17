import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import { MermaidSourceSchema } from "@flowchart/core";
import type { DiagramType } from "@flowchart/core";
import { BpmnModdle } from "bpmn-moddle";
import { parseSocialCard, isSocialCardType } from "./social-cards.ts";
import { validateGraphSource } from "./xyflow-base.ts";
import { validateFreeformRefs, type CanvasDocument } from "./freeform-canvas.ts";

function extractFirstJsonValue(text: string): string | null {
  const s = text.trim();
  const firstObj = s.indexOf("{");
  const firstArr = s.indexOf("[");
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
  if (start === -1) return null;

  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1).trim();
    }
  }

  return null;
}

function normalizeJsonLikeText(text: string): string {
  return text
    .replace(/“|”/g, '"')
    .replace(/‘|’/g, "'")
    .replace(/^﻿/, "")
    .trim();
}

export function parsePossiblyBrokenJson(raw: string): string | null {
  const candidates: string[] = [];
  const cleaned = normalizeJsonLikeText(raw);
  if (cleaned) candidates.push(cleaned);
  const extracted = extractFirstJsonValue(cleaned);
  if (extracted && extracted !== cleaned) candidates.push(extracted);

  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      try {
        const repaired = jsonrepair(candidate);
        JSON.parse(repaired);
        return repaired;
      } catch {
        // Continue trying fallbacks
      }
    }
  }

  return null;
}

async function validateBpmnXml(xml: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = xml.trim();
  if (!trimmed.startsWith("<?xml")) {
    return { ok: false, error: 'BPMN XML must start with `<?xml version="1.0" encoding="UTF-8"?>`.' };
  }
  if (!trimmed.includes("<bpmn2:definitions") && !trimmed.includes("<definitions")) {
    return { ok: false, error: "BPMN XML must include a <bpmn2:definitions> root element." };
  }
  try {
    const moddle = new BpmnModdle();
    await moddle.fromXML(trimmed);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid BPMN XML" };
  }
}

function cleanModelOutput(text: string): string {
  return text
    .trim()
    .replace(/^```(?:mermaid|json|xml|bpmn)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Per-type structural validators — go beyond "is it valid JSON?" and catch
// structurally empty/broken outputs so the retry pass actually fires.
// ---------------------------------------------------------------------------

const MERMAID_VALID_KEYWORDS = [
  "flowchart", "graph", "sequenceDiagram", "erDiagram", "gantt",
  "mindmap", "classDiagram", "stateDiagram", "timeline", "C4Context",
  "pie", "quadrantChart", "sankey-beta", "gitGraph", "xychart-beta",
  "block-beta", "architecture-beta", "journey", "requirementDiagram",
  "zenuml",
];

function validateMermaidStructure(source: string): { ok: boolean; reason?: string } {
  const first = source.trimStart().split(/[\s\n(]/)[0].toLowerCase();
  const valid = MERMAID_VALID_KEYWORDS.some((kw) => source.trimStart().toLowerCase().startsWith(kw.toLowerCase()));
  if (!valid) {
    return { ok: false, reason: `Mermaid output does not start with a valid diagram type keyword (got: "${first}"). Must start with flowchart, sequenceDiagram, erDiagram, gantt, etc.` };
  }
  return { ok: true };
}

const ExcalidrawSchema = z.object({
  elements: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      x: z.number(),
      y: z.number(),
    })
  ).min(1, "Excalidraw elements array must have at least one element"),
});

const ReactFlowSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      data: z.record(z.string(), z.unknown()),
    })
  ).min(1, "ReactFlow nodes array must have at least one node"),
  edges: z.array(
    z.object({ id: z.string(), source: z.string(), target: z.string() })
  ),
});

const EChartsSchema = z.object({
  series: z.array(z.unknown()).min(1, "ECharts option must have at least one series entry"),
});

const NivoSchema = z.object({
  type: z.string().min(1, "Nivo JSON must have a 'type' field"),
  data: z.unknown().refine((v) => v !== undefined && v !== null, { message: "Nivo JSON must have a 'data' field" }),
});

const FreeformTextSchema = z.object({
  content: z.string(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  color: z.string().optional(),
  bold: z.boolean().optional(),
});

const FreeformBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  role: z.string().optional(),
  rotation: z.number().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeDash: z.enum(["solid", "dashed", "dotted"]).optional(),
  opacity: z.number().optional(),
  frameId: z.string().nullable().optional(),
  locked: z.boolean().optional(),
  text: FreeformTextSchema.optional(),
});

const FreeformSizedShapeSchema = FreeformBaseSchema.passthrough().extend({
  type: z.enum([
    "rectangle",
    "ellipse",
    "diamond",
    "triangle",
    "cylinder",
    "cloud",
    "hexagon",
    "star",
    "sticky",
    "text",
    "frame",
    "card",
    "table",
    "image",
    "metric",
    "dashboard",
    "chart",
    "feed_table",
    "mindmap",
    "fishbone",
    "scurve_timeline",
    "isometric_block",
    "mockup",
  ]),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  cornerRadius: z.number().optional(),
});

const FreeformPathShapeSchema = FreeformBaseSchema.extend({
  type: z.literal("path"),
  points: z.array(z.tuple([z.number(), z.number()])),
});

const FreeformEndpointSchema = z.union([
  z.object({ x: z.number(), y: z.number() }),
  z.object({
    shapeId: z.string().min(1),
    anchor: z.enum(["top", "right", "bottom", "left", "center", "auto"]).optional(),
  }),
]);

const FreeformArrowShapeSchema = FreeformBaseSchema.extend({
  type: z.enum(["arrow", "line"]),
  start: FreeformEndpointSchema,
  end: FreeformEndpointSchema,
  label: z.string().optional(),
  routing: z.enum(["straight", "curved", "orthogonal"]).optional(),
  arrowStart: z.boolean().optional(),
  arrowEnd: z.boolean().optional(),
});

const FreeformShapeSchema = z.union([FreeformSizedShapeSchema, FreeformPathShapeSchema, FreeformArrowShapeSchema]);

const FreeformCanvasSchema = z.object({
  version: z.literal(1),
  renderMode: z.enum(["clean", "sketchy"]).optional(),
  shapes: z.array(FreeformShapeSchema).min(1, "Freeform canvas must have at least one shape"),
});

function validateReactFlowEdgeRefs(parsed: { nodes: { id: string }[]; edges: { id: string; source: string; target: string }[] }): string | null {
  const nodeIds = new Set(parsed.nodes.map((n) => n.id));
  const dangling = parsed.edges.filter((e) => !nodeIds.has(e.source) || !nodeIds.has(e.target));
  if (dangling.length > 0) {
    return `ReactFlow edges reference non-existent node IDs: ${dangling.map((e) => e.id).join(", ")}`;
  }
  return null;
}

export async function validateAndRepairOutput(diagramType: DiagramType, raw: string): Promise<{ ok: true; source: string } | { ok: false; reason: string }> {
  const cleaned = cleanModelOutput(raw);

  if (diagramType === "mermaid") {
    try {
      MermaidSourceSchema.parse(cleaned);
    } catch {
      return { ok: false, reason: "Mermaid source is empty or exceeds maximum length" };
    }
    const structural = validateMermaidStructure(cleaned);
    if (!structural.ok) return { ok: false, reason: structural.reason! };
    return { ok: true, source: cleaned };
  }

  if (["excalidraw", "reactflow", "echarts", "nivo", "freeform"].includes(diagramType)) {
    const repaired = parsePossiblyBrokenJson(cleaned);
    if (!repaired) return { ok: false, reason: `Invalid JSON for ${diagramType}` };

    let parsed: unknown;
    try { parsed = JSON.parse(repaired); } catch { return { ok: false, reason: `Could not parse ${diagramType} JSON after repair` }; }

    if (diagramType === "excalidraw") {
      const result = ExcalidrawSchema.safeParse(parsed);
      if (!result.success) return { ok: false, reason: `Excalidraw structure invalid: ${result.error.issues[0]?.message}` };
    }
    if (diagramType === "reactflow") {
      const result = ReactFlowSchema.safeParse(parsed);
      if (!result.success) return { ok: false, reason: `ReactFlow structure invalid: ${result.error.issues[0]?.message}` };
      const refError = validateReactFlowEdgeRefs(result.data as { nodes: { id: string }[]; edges: { id: string; source: string; target: string }[] });
      if (refError) return { ok: false, reason: refError };
    }
    if (diagramType === "echarts") {
      const result = EChartsSchema.safeParse(parsed);
      if (!result.success) return { ok: false, reason: `ECharts structure invalid: ${result.error.issues[0]?.message}` };
    }
    if (diagramType === "nivo") {
      const result = NivoSchema.safeParse(parsed);
      if (!result.success) return { ok: false, reason: `Nivo structure invalid: ${result.error.issues[0]?.message}` };
    }
    if (diagramType === "freeform") {
      const result = FreeformCanvasSchema.safeParse(parsed);
      if (!result.success) return { ok: false, reason: `Freeform canvas structure invalid: ${result.error.issues[0]?.message}` };
      const refErrors = validateFreeformRefs(result.data as CanvasDocument);
      if (refErrors.length > 0) return { ok: false, reason: `Freeform canvas has broken references: ${refErrors.join("; ")}` };
    }

    return { ok: true, source: repaired };
  }

  if (diagramType === "bpmn") {
    const v = await validateBpmnXml(cleaned);
    if (!v.ok) return { ok: false, reason: v.error };
    return { ok: true, source: cleaned };
  }

  if (isSocialCardType(diagramType)) {
    const r = parseSocialCard(parsePossiblyBrokenJson(cleaned) ?? cleaned);
    if (!r.ok) return { ok: false, reason: r.error };
    return { ok: true, source: JSON.stringify(r.card, null, 2) };
  }

  if (diagramType === "cloud" || diagramType === "erd" || diagramType === "orgchart") {
    const repaired = parsePossiblyBrokenJson(cleaned);
    if (!repaired) return { ok: false, reason: `Invalid JSON for ${diagramType}` };
    const v = validateGraphSource(repaired);
    if (!v.ok) return { ok: false, reason: `${diagramType} structure invalid: ${v.reason}` };
    return { ok: true, source: repaired };
  }

  return { ok: false, reason: "Unsupported diagram type" };
}
