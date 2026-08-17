import { parseFreeformSource, serializeFreeformDocument } from "./diagrams/freeform-canvas.ts";
import { applyCanvasOps, type CanvasOp } from "./diagrams/freeform-ops.ts";
import { serializeForModel } from "./diagrams/freeform-model-view.ts";

/** Replace every occurrence of `find` in `source`. split/join avoids regex escaping. replaced:0 means not found. */
export function applyPatch(
  source: string,
  find: string,
  replace: string,
): { source: string; replaced: number } {
  if (!find || !source.includes(find)) return { source, replaced: 0 };
  const parts = source.split(find);
  return { source: parts.join(replace), replaced: parts.length - 1 };
}

/** True when `s` parses as JSON. Used to reject a surgical patch that would corrupt a JSON-based diagram. */
export function isValidJson(s: string): boolean {
  try { JSON.parse(s); return true; } catch { return false; }
}

export type ApplyOpsToSourceResult = {
  source: string | null;
  applied: number;
  errors: { index: number; op: string; message: string }[];
  canvas: string;
};

/** Parses a freeform canvas source, runs ops through the ops engine, and re-serializes. source:null when nothing applied. */
export function applyOpsToSource(source: string, ops: CanvasOp[]): ApplyOpsToSourceResult {
  const { doc } = parseFreeformSource(source);
  const result = applyCanvasOps(doc, ops);
  const canvas = serializeForModel(result.doc);
  return {
    source: result.applied > 0 ? serializeFreeformDocument(result.doc) : null,
    applied: result.applied,
    errors: result.errors,
    canvas,
  };
}
