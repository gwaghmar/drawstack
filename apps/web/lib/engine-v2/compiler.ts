import type {
  EngineChartDatum,
  EngineChartNode,
  EngineDocument,
  EngineFrameNode,
  EngineGraphNode,
  EngineMetricNode,
  EngineNode,
  EngineStyle,
  EngineTextNode,
  EngineTokens,
  FrameLayout,
} from "./document";
import type { GraphDocument, GraphEdge, GraphField, GraphNode } from "./graph";

const MAX_PROMPT_LENGTH = 4_000;
const MAX_MODEL_OUTPUT_LENGTH = 250_000;
const MAX_NODES = 240;
const MAX_DEPTH = 8;
const MAX_CHART_POINTS = 120;
const MAX_TOKEN_ENTRIES = 64;

const RECORD_KEY = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const NODE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const CSS_COLOR_FUNCTION = /^(?:rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)$/i;
const CSS_COLOR_NAME = /^[a-zA-Z]{1,24}$/;

const DOCUMENT_KEYS = new Set(["version", "engine", "name", "artboard", "tokens", "children"]);
const ARTBOARD_KEYS = new Set(["width", "minHeight", "background"]);
const TOKENS_KEYS = new Set(["colors", "spacing", "radii"]);
const BASE_NODE_KEYS = ["id", "name", "type", "style"] as const;
const TEXT_KEYS = new Set([...BASE_NODE_KEYS, "content", "variant"]);
const METRIC_KEYS = new Set([...BASE_NODE_KEYS, "label", "value", "detail", "tone"]);
const CHART_KEYS = new Set([...BASE_NODE_KEYS, "title", "chartType", "data", "valuePrefix", "valueSuffix"]);
const GRAPH_KEYS = new Set([...BASE_NODE_KEYS, "title", "graph"]);
const FRAME_KEYS = new Set([...BASE_NODE_KEYS, "layout", "children"]);
const STYLE_KEYS = new Set([
  "background",
  "color",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "minHeight",
  "width",
  "flex",
  "alignSelf",
]);
const LAYOUT_KEYS = new Set(["mode", "direction", "gap", "padding", "columns", "align", "justify"]);
const DATUM_KEYS = new Set(["label", "value", "series", "x", "y"]);
const GRAPH_DOCUMENT_KEYS = new Set(["name", "direction", "nodes", "edges"]);
const GRAPH_NODE_KEYS = new Set(["id", "label", "kind", "subtitle", "fields", "group", "width", "height", "tone"]);
const GRAPH_EDGE_KEYS = new Set(["id", "source", "target", "kind", "label", "sourceLabel", "targetLabel"]);
const GRAPH_FIELD_KEYS = new Set(["name", "type", "key"]);

export type EngineV2Composition = "chart" | "graph" | "dashboard" | "document";
export type EngineV2ChartIntent = "bar" | "line" | "area" | "donut" | "scatter" | "stacked-bar" | null;

export type EngineV2PromptIntent = {
  normalizedPrompt: string;
  composition: EngineV2Composition;
  chartType: EngineV2ChartIntent;
};

export type EngineV2ValidationIssue = {
  path: string;
  message: string;
};

export type EngineV2CompileResult =
  | {
      ok: true;
      document: EngineDocument;
      intent: EngineV2PromptIntent;
    }
  | {
      ok: false;
      intent: EngineV2PromptIntent | null;
      issues: EngineV2ValidationIssue[];
    };

type ValidationContext = {
  issues: EngineV2ValidationIssue[];
  ids: Set<string>;
  nodeCount: number;
  colors: Set<string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addIssue(context: ValidationContext, path: string, message: string): void {
  context.issues.push({ path, message });
}

function hasExactKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  context: ValidationContext,
  path: string,
): boolean {
  let valid = true;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addIssue(context, `${path}.${key}`, "Unknown field");
      valid = false;
    }
  }
  return valid;
}

function readString(
  value: unknown,
  context: ValidationContext,
  path: string,
  min: number,
  max: number,
): string | null {
  if (typeof value !== "string") {
    addIssue(context, path, "Expected a string");
    return null;
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    addIssue(context, path, `Expected ${min}-${max} characters`);
    return null;
  }
  return normalized;
}

function readNumber(
  value: unknown,
  context: ValidationContext,
  path: string,
  min: number,
  max: number,
  integer = false,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    addIssue(context, path, `Expected a finite number from ${min} to ${max}`);
    return null;
  }
  if (integer && !Number.isInteger(value)) {
    addIssue(context, path, "Expected an integer");
    return null;
  }
  return value;
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  context: ValidationContext,
  path: string,
): T | null {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    addIssue(context, path, `Expected one of: ${allowed.join(", ")}`);
    return null;
  }
  return value as T;
}

function isSafeColor(value: string, colors: Set<string>): boolean {
  if (value.startsWith("$")) return colors.has(value.slice(1));
  return HEX_COLOR.test(value) || CSS_COLOR_FUNCTION.test(value) || CSS_COLOR_NAME.test(value);
}

function readColor(
  value: unknown,
  context: ValidationContext,
  path: string,
): string | null {
  const color = readString(value, context, path, 1, 80);
  if (color === null) return null;
  if (!isSafeColor(color, context.colors)) {
    addIssue(context, path, "Expected a color or a defined color token");
    return null;
  }
  return color;
}

function readOptionalColor(
  value: unknown,
  context: ValidationContext,
  path: string,
): string | undefined {
  if (value === undefined) return undefined;
  return readColor(value, context, path) ?? undefined;
}

function readOptionalNumber(
  value: unknown,
  context: ValidationContext,
  path: string,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;
  return readNumber(value, context, path, min, max) ?? undefined;
}

function validateTokenNumberMap(
  value: unknown,
  context: ValidationContext,
  path: string,
  min: number,
  max: number,
): Record<string, number> | null {
  if (!isRecord(value)) {
    addIssue(context, path, "Expected an object");
    return null;
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_TOKEN_ENTRIES) {
    addIssue(context, path, `Cannot contain more than ${MAX_TOKEN_ENTRIES} entries`);
    return null;
  }
  const output: Record<string, number> = {};
  for (const [key, raw] of entries) {
    if (!RECORD_KEY.test(key)) {
      addIssue(context, `${path}.${key}`, "Invalid token name");
      continue;
    }
    const parsed = readNumber(raw, context, `${path}.${key}`, min, max);
    if (parsed !== null) output[key] = parsed;
  }
  return output;
}

function validateTokens(
  value: unknown,
  context: ValidationContext,
  path: string,
): EngineTokens | null {
  if (!isRecord(value)) {
    addIssue(context, path, "Expected an object");
    return null;
  }
  hasExactKeys(value, TOKENS_KEYS, context, path);
  if (!isRecord(value.colors)) {
    addIssue(context, `${path}.colors`, "Expected an object");
    return null;
  }
  const colorEntries = Object.entries(value.colors);
  if (colorEntries.length > MAX_TOKEN_ENTRIES) {
    addIssue(context, `${path}.colors`, `Cannot contain more than ${MAX_TOKEN_ENTRIES} entries`);
    return null;
  }
  const colors: Record<string, string> = {};
  for (const [key, raw] of colorEntries) {
    if (!RECORD_KEY.test(key)) {
      addIssue(context, `${path}.colors.${key}`, "Invalid token name");
      continue;
    }
    if (typeof raw !== "string" || !isSafeColor(raw.trim(), new Set())) {
      addIssue(context, `${path}.colors.${key}`, "Expected a literal CSS color");
      continue;
    }
    colors[key] = raw.trim();
    context.colors.add(key);
  }
  const spacing = validateTokenNumberMap(value.spacing, context, `${path}.spacing`, 0, 512);
  const radii = validateTokenNumberMap(value.radii, context, `${path}.radii`, 0, 999);
  if (!spacing || !radii) return null;
  return { colors, spacing, radii };
}

function validateStyle(
  value: unknown,
  context: ValidationContext,
  path: string,
): EngineStyle | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    addIssue(context, path, "Expected an object");
    return undefined;
  }
  hasExactKeys(value, STYLE_KEYS, context, path);
  const output: EngineStyle = {};
  const background = readOptionalColor(value.background, context, `${path}.background`);
  const color = readOptionalColor(value.color, context, `${path}.color`);
  const borderColor = readOptionalColor(value.borderColor, context, `${path}.borderColor`);
  const borderWidth = readOptionalNumber(value.borderWidth, context, `${path}.borderWidth`, 0, 32);
  const borderRadius = readOptionalNumber(value.borderRadius, context, `${path}.borderRadius`, 0, 999);
  const minHeight = readOptionalNumber(value.minHeight, context, `${path}.minHeight`, 0, 10_000);
  const flex = readOptionalNumber(value.flex, context, `${path}.flex`, 0, 100);
  if (background !== undefined) output.background = background;
  if (color !== undefined) output.color = color;
  if (borderColor !== undefined) output.borderColor = borderColor;
  if (borderWidth !== undefined) output.borderWidth = borderWidth;
  if (borderRadius !== undefined) output.borderRadius = borderRadius;
  if (minHeight !== undefined) output.minHeight = minHeight;
  if (flex !== undefined) output.flex = flex;
  if (value.width !== undefined) {
    if (typeof value.width === "number") {
      const width = readNumber(value.width, context, `${path}.width`, 0, 10_000);
      if (width !== null) output.width = width;
    } else if (typeof value.width === "string" && /^(?:100|[1-9]?\d)%$/.test(value.width)) {
      output.width = value.width;
    } else {
      addIssue(context, `${path}.width`, "Expected a number or percentage");
    }
  }
  if (value.alignSelf !== undefined) {
    const alignSelf = readEnum(
      value.alignSelf,
      ["auto", "normal", "stretch", "center", "flex-start", "flex-end", "baseline"],
      context,
      `${path}.alignSelf`,
    );
    if (alignSelf !== null) output.alignSelf = alignSelf;
  }
  return output;
}

function validateLayout(
  value: unknown,
  context: ValidationContext,
  path: string,
): FrameLayout | null {
  if (!isRecord(value)) {
    addIssue(context, path, "Expected an object");
    return null;
  }
  hasExactKeys(value, LAYOUT_KEYS, context, path);
  const mode = readEnum(value.mode, ["flex", "grid"], context, `${path}.mode`);
  const gap = readNumber(value.gap, context, `${path}.gap`, 0, 512);
  const padding = readNumber(value.padding, context, `${path}.padding`, 0, 512);
  if (mode === null || gap === null || padding === null) return null;
  const output: FrameLayout = { mode, gap, padding };
  if (mode === "flex") {
    const direction = readEnum(value.direction, ["row", "column"], context, `${path}.direction`);
    if (direction === null) return null;
    output.direction = direction;
    if (value.columns !== undefined) addIssue(context, `${path}.columns`, "Columns are only valid for grid layout");
  } else {
    const columns = readNumber(value.columns, context, `${path}.columns`, 1, 12, true);
    if (columns === null) return null;
    output.columns = columns;
    if (value.direction !== undefined) addIssue(context, `${path}.direction`, "Direction is only valid for flex layout");
  }
  if (value.align !== undefined) {
    const align = readEnum(value.align, ["stretch", "center", "flex-start", "flex-end", "baseline"], context, `${path}.align`);
    if (align !== null) output.align = align;
  }
  if (value.justify !== undefined) {
    const justify = readEnum(
      value.justify,
      ["normal", "center", "flex-start", "flex-end", "space-between", "space-around", "space-evenly"],
      context,
      `${path}.justify`,
    );
    if (justify !== null) output.justify = justify;
  }
  return output;
}

function validateBaseNode(
  value: Record<string, unknown>,
  context: ValidationContext,
  path: string,
): { id: string; name: string; style?: EngineStyle } | null {
  const id = readString(value.id, context, `${path}.id`, 1, 80);
  const name = readString(value.name, context, `${path}.name`, 1, 120);
  if (id && !NODE_ID.test(id)) addIssue(context, `${path}.id`, "Invalid node id");
  if (id && context.ids.has(id)) addIssue(context, `${path}.id`, "Node ids must be unique");
  if (id) context.ids.add(id);
  const style = validateStyle(value.style, context, `${path}.style`);
  if (!id || !NODE_ID.test(id) || !name) return null;
  return style ? { id, name, style } : { id, name };
}

function validateDatum(
  value: unknown,
  context: ValidationContext,
  path: string,
): EngineChartDatum | null {
  if (!isRecord(value)) {
    addIssue(context, path, "Expected an object");
    return null;
  }
  hasExactKeys(value, DATUM_KEYS, context, path);
  const series = value.series === undefined ? undefined : readString(value.series, context, `${path}.series`, 1, 80) ?? undefined;
  if (value.x !== undefined || value.y !== undefined) {
    const x = readNumber(value.x, context, `${path}.x`, -1_000_000_000_000, 1_000_000_000_000);
    const y = readNumber(value.y, context, `${path}.y`, -1_000_000_000_000, 1_000_000_000_000);
    const label = value.label === undefined ? undefined : readString(value.label, context, `${path}.label`, 1, 80) ?? undefined;
    return x !== null && y !== null ? { x, y, label, series } : null;
  }
  const label = readString(value.label, context, `${path}.label`, 1, 80);
  const number = readNumber(value.value, context, `${path}.value`, -1_000_000_000_000, 1_000_000_000_000);
  return label !== null && number !== null ? { label, value: number, series } : null;
}

function optionalString(value: unknown, context: ValidationContext, path: string, max = 160): string | undefined {
  return value === undefined ? undefined : readString(value, context, path, 1, max) ?? undefined;
}

function validateGraph(value: unknown, context: ValidationContext, path: string): GraphDocument | null {
  if (!isRecord(value)) {
    addIssue(context, path, "Expected an object");
    return null;
  }
  hasExactKeys(value, GRAPH_DOCUMENT_KEYS, context, path);
  const name = readString(value.name, context, `${path}.name`, 1, 120);
  const direction = value.direction === undefined ? undefined : readEnum(value.direction, ["TB", "LR"], context, `${path}.direction`) ?? undefined;
  if (!Array.isArray(value.nodes) || value.nodes.length < 1 || value.nodes.length > 160) {
    addIssue(context, `${path}.nodes`, "Expected 1-160 graph nodes");
    return null;
  }
  if (!Array.isArray(value.edges) || value.edges.length > 320) {
    addIssue(context, `${path}.edges`, "Expected up to 320 graph edges");
    return null;
  }
  const graphIds = new Set<string>();
  const nodes = value.nodes.flatMap((raw, index): GraphNode[] => {
    const nodePath = `${path}.nodes[${index}]`;
    if (!isRecord(raw)) {
      addIssue(context, nodePath, "Expected an object");
      return [];
    }
    hasExactKeys(raw, GRAPH_NODE_KEYS, context, nodePath);
    const id = readString(raw.id, context, `${nodePath}.id`, 1, 80);
    const label = readString(raw.label, context, `${nodePath}.label`, 1, 160);
    const kind = readEnum(raw.kind, ["process", "decision", "entity", "database", "person", "service", "system"], context, `${nodePath}.kind`);
    if (id && graphIds.has(id)) addIssue(context, `${nodePath}.id`, "Graph node ids must be unique");
    if (id) graphIds.add(id);
    const fields = raw.fields === undefined ? undefined : Array.isArray(raw.fields) ? raw.fields.flatMap((field, fieldIndex): GraphField[] => {
      const fieldPath = `${nodePath}.fields[${fieldIndex}]`;
      if (!isRecord(field)) {
        addIssue(context, fieldPath, "Expected an object");
        return [];
      }
      hasExactKeys(field, GRAPH_FIELD_KEYS, context, fieldPath);
      const fieldName = readString(field.name, context, `${fieldPath}.name`, 1, 80);
      const fieldType = optionalString(field.type, context, `${fieldPath}.type`, 80);
      const key = field.key === undefined ? undefined : readEnum(field.key, ["primary", "foreign"], context, `${fieldPath}.key`) ?? undefined;
      return fieldName ? [{ name: fieldName, type: fieldType, key }] : [];
    }) : (addIssue(context, `${nodePath}.fields`, "Expected an array"), undefined);
    if (!id || !NODE_ID.test(id) || !label || !kind) return [];
    return [{
      id,
      label,
      kind,
      subtitle: optionalString(raw.subtitle, context, `${nodePath}.subtitle`),
      fields,
      group: optionalString(raw.group, context, `${nodePath}.group`, 80),
      width: raw.width === undefined ? undefined : readNumber(raw.width, context, `${nodePath}.width`, 48, 1_000) ?? undefined,
      height: raw.height === undefined ? undefined : readNumber(raw.height, context, `${nodePath}.height`, 36, 1_000) ?? undefined,
      tone: raw.tone === undefined ? undefined : readEnum(raw.tone, ["neutral", "accent", "positive", "warning"] as const, context, `${nodePath}.tone`) ?? undefined,
    }];
  });
  const edgeIds = new Set<string>();
  const edges = value.edges.flatMap((raw, index): GraphEdge[] => {
    const edgePath = `${path}.edges[${index}]`;
    if (!isRecord(raw)) {
      addIssue(context, edgePath, "Expected an object");
      return [];
    }
    hasExactKeys(raw, GRAPH_EDGE_KEYS, context, edgePath);
    const id = readString(raw.id, context, `${edgePath}.id`, 1, 80);
    const source = readString(raw.source, context, `${edgePath}.source`, 1, 80);
    const target = readString(raw.target, context, `${edgePath}.target`, 1, 80);
    if (id && edgeIds.has(id)) addIssue(context, `${edgePath}.id`, "Graph edge ids must be unique");
    if (id) edgeIds.add(id);
    if (source && !graphIds.has(source)) addIssue(context, `${edgePath}.source`, "Graph endpoint not found");
    if (target && !graphIds.has(target)) addIssue(context, `${edgePath}.target`, "Graph endpoint not found");
    if (!id || !source || !target) return [];
    return [{
      id,
      source,
      target,
      kind: raw.kind === undefined ? undefined : readEnum(raw.kind, ["flow", "association", "dependency", "data", "reports-to"] as const, context, `${edgePath}.kind`) ?? undefined,
      label: optionalString(raw.label, context, `${edgePath}.label`, 80),
      sourceLabel: optionalString(raw.sourceLabel, context, `${edgePath}.sourceLabel`, 40),
      targetLabel: optionalString(raw.targetLabel, context, `${edgePath}.targetLabel`, 40),
    }];
  });
  return name ? { name, direction, nodes, edges } : null;
}

function validateNode(
  value: unknown,
  context: ValidationContext,
  path: string,
  depth: number,
): EngineNode | null {
  context.nodeCount += 1;
  if (context.nodeCount > MAX_NODES) {
    addIssue(context, path, `Document cannot contain more than ${MAX_NODES} nodes`);
    return null;
  }
  if (depth > MAX_DEPTH) {
    addIssue(context, path, `Node nesting cannot exceed ${MAX_DEPTH} levels`);
    return null;
  }
  if (!isRecord(value)) {
    addIssue(context, path, "Expected an object");
    return null;
  }
  const type = readEnum(value.type, ["text", "metric", "chart", "graph", "frame"], context, `${path}.type`);
  if (type === null) return null;
  hasExactKeys(value, type === "text" ? TEXT_KEYS : type === "metric" ? METRIC_KEYS : type === "chart" ? CHART_KEYS : type === "graph" ? GRAPH_KEYS : FRAME_KEYS, context, path);
  const base = validateBaseNode(value, context, path);
  if (!base) return null;
  if (type === "text") {
    const content = readString(value.content, context, `${path}.content`, 1, 8_000);
    const variant = readEnum(value.variant, ["eyebrow", "display", "heading", "body", "caption"], context, `${path}.variant`);
    if (content === null || variant === null) return null;
    return { ...base, type, content, variant } satisfies EngineTextNode;
  }
  if (type === "metric") {
    const label = readString(value.label, context, `${path}.label`, 1, 160);
    const metricValue = readString(value.value, context, `${path}.value`, 1, 80);
    const detail = readString(value.detail, context, `${path}.detail`, 0, 240);
    const tone = readEnum(value.tone, ["neutral", "positive", "warning"], context, `${path}.tone`);
    if (label === null || metricValue === null || detail === null || tone === null) return null;
    return { ...base, type, label, value: metricValue, detail, tone } satisfies EngineMetricNode;
  }
  if (type === "chart") {
    const title = readString(value.title, context, `${path}.title`, 1, 160);
    const chartType = readEnum(value.chartType, ["bar", "line", "area", "donut", "scatter", "stacked-bar"], context, `${path}.chartType`);
    if (!Array.isArray(value.data) || value.data.length < 1 || value.data.length > MAX_CHART_POINTS) {
      addIssue(context, `${path}.data`, `Expected 1-${MAX_CHART_POINTS} data points`);
      return null;
    }
    const data = value.data.map((datum, index) => validateDatum(datum, context, `${path}.data[${index}]`));
    const valuePrefix = value.valuePrefix === undefined ? undefined : readString(value.valuePrefix, context, `${path}.valuePrefix`, 0, 16) ?? undefined;
    const valueSuffix = value.valueSuffix === undefined ? undefined : readString(value.valueSuffix, context, `${path}.valueSuffix`, 0, 16) ?? undefined;
    if (title === null || chartType === null || data.some((datum) => datum === null)) return null;
    return { ...base, type, title, chartType, data: data as EngineChartDatum[], valuePrefix, valueSuffix } satisfies EngineChartNode;
  }
  if (type === "graph") {
    const title = readString(value.title, context, `${path}.title`, 1, 160);
    const graph = validateGraph(value.graph, context, `${path}.graph`);
    if (!title || !graph) return null;
    return { ...base, type, title, graph } satisfies EngineGraphNode;
  }
  const layout = validateLayout(value.layout, context, `${path}.layout`);
  if (!Array.isArray(value.children)) {
    addIssue(context, `${path}.children`, "Expected an array");
    return null;
  }
  const children = value.children.map((child, index) => validateNode(child, context, `${path}.children[${index}]`, depth + 1));
  if (layout === null || children.some((child) => child === null)) return null;
  return { ...base, type, layout, children: children as EngineNode[] } satisfies EngineFrameNode;
}

export function validateEngineV2Document(input: unknown):
  | { ok: true; document: EngineDocument }
  | { ok: false; issues: EngineV2ValidationIssue[] } {
  const context: ValidationContext = { issues: [], ids: new Set(), nodeCount: 0, colors: new Set() };
  if (!isRecord(input)) return { ok: false, issues: [{ path: "$", message: "Expected an object" }] };
  hasExactKeys(input, DOCUMENT_KEYS, context, "$");
  if (input.version !== 2) addIssue(context, "$.version", "Expected version 2");
  if (input.engine !== "dom-css") addIssue(context, "$.engine", "Expected dom-css engine");
  const name = readString(input.name, context, "$.name", 1, 120);
  const tokens = validateTokens(input.tokens, context, "$.tokens");
  if (!isRecord(input.artboard)) {
    addIssue(context, "$.artboard", "Expected an object");
  }
  const artboard = isRecord(input.artboard) ? input.artboard : {};
  hasExactKeys(artboard, ARTBOARD_KEYS, context, "$.artboard");
  const width = readNumber(artboard.width, context, "$.artboard.width", 320, 2_400, true);
  const minHeight = readNumber(artboard.minHeight, context, "$.artboard.minHeight", 240, 10_000, true);
  const background = readColor(artboard.background, context, "$.artboard.background");
  if (!Array.isArray(input.children) || input.children.length < 1) {
    addIssue(context, "$.children", "Expected at least one root node");
  }
  const children = Array.isArray(input.children)
    ? input.children.map((node, index) => validateNode(node, context, `$.children[${index}]`, 1))
    : [];
  if (context.issues.length || !name || !tokens || width === null || minHeight === null || !background || children.some((node) => node === null)) {
    return { ok: false, issues: context.issues };
  }
  return {
    ok: true,
    document: {
      version: 2,
      engine: "dom-css",
      name,
      artboard: { width, minHeight, background },
      tokens,
      children: children as EngineNode[],
    },
  };
}

export function classifyEngineV2Prompt(prompt: string): EngineV2PromptIntent {
  if (typeof prompt !== "string") throw new TypeError("Prompt must be a string");
  const normalizedPrompt = prompt.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalizedPrompt) throw new Error("Prompt cannot be empty");
  if (normalizedPrompt.length > MAX_PROMPT_LENGTH) throw new Error(`Prompt cannot exceed ${MAX_PROMPT_LENGTH} characters`);
  const words = ` ${normalizedPrompt.toLowerCase()} `;
  let chartType: EngineV2ChartIntent = null;
  if (/\b(?:donut|doughnut|pie)\s+(?:chart|graph)\b/.test(words)) chartType = "donut";
  else if (/\bscatter\s+(?:chart|plot|graph)\b/.test(words)) chartType = "scatter";
  else if (/\bstacked\s+(?:bar|column)\s+chart\b/.test(words)) chartType = "stacked-bar";
  else if (/\barea\s+chart\b/.test(words)) chartType = "area";
  else if (/\b(?:line|trend|time\s*series)\s+(?:chart|graph)\b|\bover\s+time\b/.test(words)) chartType = "line";
  else if (/\b(?:bar|column)\s+(?:chart|graph)\b/.test(words)) chartType = "bar";
  let composition: EngineV2Composition = "document";
  if (/\b(?:dashboard|scorecard|kpi\s+board)\b/.test(words)) composition = "dashboard";
  else if (/\b(?:flowchart|erd|entity relationship|org chart|organization chart|system architecture|dependency graph|process flow)\b/.test(words)) composition = "graph";
  else if (chartType !== null || /\b(?:chart|plot)\b/.test(words)) composition = "chart";
  return { normalizedPrompt, composition, chartType };
}

export function buildEngineV2GenerationPrompt(intent: EngineV2PromptIntent): string {
  return [
    "Create one EngineDocument JSON object for the user's request.",
    "Return JSON only. Do not include Markdown, explanations, or JavaScript.",
    'The root must use version 2 and engine "dom-css".',
    "Use only frame, text, metric, chart, and graph nodes. Chart types are bar, line, area, donut, scatter, and stacked-bar.",
    "Use flex or grid frames for layout. Every node id must be unique.",
    "Document fields: version, engine, name, artboard {width,minHeight,background}, tokens {colors,spacing,radii}, children.",
    "Every node needs id, name, and type. Text needs content and variant. Metric needs label, value, detail, and tone.",
    "Chart needs title, chartType, and data [{label,value}]. Frame needs layout {mode,gap,padding} and children.",
    "Scatter data uses [{x,y,label?,series?}]. Other chart data can add series for multiple series.",
    "Graph needs title and graph {name,direction,nodes,edges}. Graph nodes use id,label,kind. Kinds: process, decision, entity, database, person, service, system. Graph edges use id,source,target and optional kind or label.",
    "Flex layout also needs direction. Grid layout also needs columns.",
    "Do not invent facts presented as user data. Clearly label illustrative data.",
    `Composition: ${intent.composition}.`,
    `Requested chart type: ${intent.chartType ?? "not specified"}.`,
    `User request: ${JSON.stringify(intent.normalizedPrompt)}`,
  ].join("\n");
}

function collectChartTypes(nodes: EngineNode[], output: Set<EngineChartNode["chartType"]>): void {
  for (const node of nodes) {
    if (node.type === "chart") output.add(node.chartType);
    if (node.type === "frame") collectChartTypes(node.children, output);
  }
}

function hasGraphNode(nodes: EngineNode[]): boolean {
  return nodes.some((node) => node.type === "graph" || (node.type === "frame" && hasGraphNode(node.children)));
}

function parseModelJson(output: string): unknown {
  const trimmed = output.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export function compileEngineV2ModelOutput(prompt: string, modelOutput: string): EngineV2CompileResult {
  let intent: EngineV2PromptIntent;
  try {
    intent = classifyEngineV2Prompt(prompt);
  } catch (error) {
    return {
      ok: false,
      intent: null,
      issues: [{ path: "$prompt", message: error instanceof Error ? error.message : "Invalid prompt" }],
    };
  }
  if (typeof modelOutput !== "string" || modelOutput.length > MAX_MODEL_OUTPUT_LENGTH) {
    return {
      ok: false,
      intent,
      issues: [{ path: "$output", message: `Model output must be at most ${MAX_MODEL_OUTPUT_LENGTH} characters` }],
    };
  }
  let parsed: unknown;
  try {
    parsed = parseModelJson(modelOutput);
  } catch {
    return { ok: false, intent, issues: [{ path: "$output", message: "Model output is not valid JSON" }] };
  }
  const validated = validateEngineV2Document(parsed);
  if (!validated.ok) return { ok: false, intent, issues: validated.issues };
  if (intent.composition === "chart" || intent.chartType !== null) {
    const chartTypes = new Set<EngineChartNode["chartType"]>();
    collectChartTypes(validated.document.children, chartTypes);
    if (chartTypes.size === 0) {
      return { ok: false, intent, issues: [{ path: "$.children", message: "The request requires a chart node" }] };
    }
    if (intent.chartType !== null && !chartTypes.has(intent.chartType)) {
      return {
        ok: false,
        intent,
        issues: [{ path: "$.children", message: `The request requires a ${intent.chartType} chart` }],
      };
    }
  }
  if (intent.composition === "graph" && !hasGraphNode(validated.document.children)) {
    return { ok: false, intent, issues: [{ path: "$.children", message: "The request requires a graph node" }] };
  }
  return { ok: true, intent, document: validated.document };
}
