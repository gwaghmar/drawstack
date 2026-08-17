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

const FreeformPathShapeSchema = FreeformBaseSchema.passthrough().extend({
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

const FreeformArrowShapeSchema = FreeformBaseSchema.passthrough().extend({
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

// Only checks the envelope; individual shapes are validated one at a time in
// validateAndRepairOutput so a truncated trailing shape (hit maxOutputTokens
// mid-object -- the single most common real failure, confirmed by testing
// against live model output) drops just that shape instead of the AI's other
// 10-20 perfectly valid ones. Same "keep-last-good" principle the client-side
// parseFreeformSource already uses; the server-side validator didn't.
const FreeformCanvasEnvelopeSchema = z.object({
  version: z.literal(1),
  renderMode: z.enum(["clean", "sketchy"]).optional(),
  shapes: z.array(z.unknown()).min(1, "Freeform canvas must have at least one shape"),
  // The AI never authors comments -- opaque cargo here, just carried through
  // so an edit to a commented project doesn't silently delete the comments.
  comments: z.array(z.unknown()).optional(),
});

// Normalizes obviously-recoverable AI mistakes in place before Zod validation,
// so one shape's harmless slip doesn't reject the whole document:
// - `text: "some string"` instead of the documented `text: { content: ... }`.
// - a missing x/y on a shape. Unlike width/height (real auto-sizing feature),
//   the render layer has no fallback for an undefined anchor position -- but
//   defaulting to the canvas origin is still far better than losing the whole
//   document; the shape lands visible and the user can drag it into place.
function normalizeShapesInPlace(parsed: unknown): void {
  if (!parsed || typeof parsed !== "object") return;
  const shapes = (parsed as { shapes?: unknown }).shapes;
  if (!Array.isArray(shapes)) return;
  for (const shape of shapes) {
    if (!shape || typeof shape !== "object") continue;
    // The model frequently emits `field: null` for an unset optional field
    // (fill, strokeDash, etc.) instead of omitting the key. Zod's .optional()
    // accepts undefined, not null, so this failed validation every time it
    // happened. Confirmed live on two separate fields (fill, strokeDash) --
    // null and "not provided" mean the same thing for every field on a shape,
    // so strip nulls uniformly rather than special-case each field as found.
    for (const key of Object.keys(shape)) {
      if ((shape as Record<string, unknown>)[key] === null) delete (shape as Record<string, unknown>)[key];
    }
    const s = shape as { text?: unknown; x?: unknown; y?: unknown };
    if (typeof s.text === "string") s.text = { content: s.text };
    if (typeof s.x !== "number") s.x = 0;
    if (typeof s.y !== "number") s.y = 0;
  }
}

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

  normalizeShapesInPlace(parsed);

  const envelope = FreeformCanvasEnvelopeSchema.safeParse(parsed);
  if (!envelope.success) {
    return { ok: false, reason: `Freeform canvas structure invalid: ${envelope.error.issues[0]?.message}` };
  }

  const validShapes: unknown[] = [];
  let firstShapeError: string | undefined;
  for (const shape of envelope.data.shapes) {
    const shapeResult = FreeformShapeSchema.safeParse(shape);
    if (shapeResult.success) {
      validShapes.push(shapeResult.data);
    } else {
      firstShapeError ??= shapeResult.error.issues[0]?.message;
    }
  }

  if (validShapes.length === 0) {
    return { ok: false, reason: `Freeform canvas structure invalid: ${firstShapeError ?? "no valid shapes"}` };
  }

  // Dropping an individually-invalid shape (above) can orphan whatever pointed
  // at it -- a child's frameId, an arrow's endpoint. Found live: a truncated
  // frame got dropped, and its two children (which validated fine on their
  // own) then failed the whole document on "frameId is not a frame". Same
  // keep-last-good principle, one level up: ungroup orphaned children instead
  // of losing them, drop only the arrows that are now unrenderable.
  const survivingIds = new Set(validShapes.map((s) => (s as { id: string }).id));
  const frameIds = new Set(
    validShapes.filter((s) => (s as { type: string }).type === "frame").map((s) => (s as { id: string }).id)
  );
  for (const shape of validShapes) {
    const s = shape as { frameId?: string | null };
    if (s.frameId && !frameIds.has(s.frameId)) s.frameId = null;
  }
  const isDanglingArrow = (shape: unknown): boolean => {
    const s = shape as { type: string; start?: { shapeId?: string }; end?: { shapeId?: string } };
    if (s.type !== "arrow" && s.type !== "line") return false;
    const refs = [s.start?.shapeId, s.end?.shapeId].filter((id): id is string => typeof id === "string");
    return refs.some((id) => !survivingIds.has(id));
  };
  const finalShapes = validShapes.filter((s) => !isDanglingArrow(s));

  if (finalShapes.length === 0) {
    return { ok: false, reason: "Freeform canvas structure invalid: no shapes survived reference cleanup" };
  }

  const doc = {
    version: envelope.data.version,
    renderMode: envelope.data.renderMode,
    shapes: finalShapes,
    comments: envelope.data.comments,
  };

  const refErrors = validateFreeformRefs(doc as CanvasDocument);
  if (refErrors.length > 0) {
    return { ok: false, reason: `Freeform canvas has broken references: ${refErrors.join("; ")}` };
  }

  // Serialize the validated (and possibly coerced, e.g. text: "str" -> {content})
  // data, not the raw repaired string -- otherwise a shape we silently fixed to
  // pass validation would still reach the client in its original broken shape.
  return { ok: true, source: JSON.stringify(doc) };
}
