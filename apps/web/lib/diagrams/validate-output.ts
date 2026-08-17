import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import type { DiagramType } from "@flowchart/core";
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

const FreeformTextSchema = z.object({
  // Renderer guards with `shape.text?.content` and skips silently when absent
  // (freeform-svg.ts, freeform-renderer.tsx) -- a text block with no content
  // is inert, not malformed, and must not fail the whole document.
  content: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  color: z.string().optional(),
  bold: z.boolean().optional(),
  wrap: z.boolean().optional(),
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
    "step_timeline",
    "isometric_block",
    "mockup",
    "venn_timeline",
    "tech_hud_panel",
    "layered_process_map",
    "dot_matrix",
    "pictogram",
    "pictogram_row",
    "mesh_connector",
  ]),
  x: z.number(),
  y: z.number(),
  // getShapeBounds() falls through to computeDynamicShapeDimensions() for any
  // shape missing width/height -- content-aware auto-sizing is a real,
  // load-bearing render-path capability, not a malformed-output case.
  width: z.number().optional(),
  height: z.number().optional(),
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
  waypoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  showJunctions: z.boolean().optional(),
});

const FreeformShapeSchema = z.union([FreeformSizedShapeSchema, FreeformPathShapeSchema, FreeformArrowShapeSchema]);

const FreeformCanvasSchema = z.object({
  version: z.literal(1),
  renderMode: z.enum(["clean", "sketchy"]).optional(),
  shapes: z.array(FreeformShapeSchema).min(1, "Freeform canvas must have at least one shape"),
});

export async function validateAndRepairOutput(
  _diagramType: DiagramType,
  raw: string,
): Promise<{ ok: true; source: string } | { ok: false; reason: string }> {
  const cleaned = cleanModelOutput(raw);

  const repaired = parsePossiblyBrokenJson(cleaned);
  if (!repaired) return { ok: false, reason: "Invalid JSON for freeform canvas" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(repaired);
  } catch {
    return { ok: false, reason: "Could not parse freeform canvas JSON after repair" };
  }

  const result = FreeformCanvasSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: `Freeform canvas structure invalid: ${result.error.issues[0]?.message}` };
  }

  const refErrors = validateFreeformRefs(result.data as CanvasDocument);
  if (refErrors.length > 0) {
    return { ok: false, reason: `Freeform canvas has broken references: ${refErrors.join("; ")}` };
  }

  return { ok: true, source: repaired };
}
