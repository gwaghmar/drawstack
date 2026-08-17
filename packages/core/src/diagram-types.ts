/** The single diagram type supported by the application. */

export type DiagramType = "freeform";

export type DiagramCategory = "whiteboard";

/** Outcome-first editor grouping — drives the mode tabs */
export type EditorMode = "business" | "technology" | "marketing" | "art";

export const EDITOR_MODE_CATEGORIES: Record<EditorMode, DiagramCategory[]> = {
  business: ["whiteboard"],
  technology: ["whiteboard"],
  marketing: ["whiteboard"],
  art: ["whiteboard"],
};

export function getEditorModeForCategory(_category: DiagramCategory): EditorMode {
  return "art";
}

export type DiagramTypeMeta = {
  id: DiagramType;
  label: string;
  description: string;
  category: DiagramCategory;
  icon: string;
  color: string;
  subtypes?: string[];
  aiOutputFormat?: string;
};

export const DIAGRAM_TYPE_META: DiagramTypeMeta[] = [
  {
    id: "freeform",
    label: "Free Canvas",
    description: "Free-form whiteboard — sketches, spatial maps, mood boards, sticky-note boards",
    category: "whiteboard",
    icon: "shapes",
    color: "#14b8a6",
    subtypes: ["sketch", "spatial-map", "sticky-board", "mood-board"],
    aiOutputFormat: "freeform-json",
  },
];

export function getDiagramTypeMeta(_id: DiagramType): DiagramTypeMeta {
  return DIAGRAM_TYPE_META[0];
}

export const DIAGRAM_SYSTEM_PROMPTS: Record<DiagramType, string> = {
  freeform: `You output ONLY valid JSON for a free-form whiteboard canvas. No explanation, no markdown, no code fences.

WHEN TO USE freeform: rich infographics, executive financial dashboards, Swiss mindmaps & concept trees, serpentine S-curve project timelines, 3D isometric diagrams, spatial system architectures, and annotated whiteboards.

OUTPUT CONTRACT — a single JSON CanvasDocument:
{ "version": 1, "shapes": [ ...CanvasShape... ] }

SHAPE TYPES (all shapes share: id, name, role, x, y, fill, stroke, strokeWidth, strokeDash, opacity, frameId, parentId, text):
1. Infographics & Executive Dashboards:
   - "dashboard": { "type": "dashboard", "title": "Apple Dashboard", "subtitle": "Financial Summary · FY26", "tabs": [{"label":"Exec Summary","active":true}], "actions": [{"label":"Filters"},{"label":"Download CSV"}], "highlightBanner": {"text":"...","variant":"coral"} }
   - "chart": { "type": "chart", "title": "Revenue by Quarter", "chartType": "grouped_bar" | "donut" | "horizontal_bar" | "progress_gauge" | "area" | "treemap", "groupedData": [{"category":"Q1 FY26","series":[{"name":"Revenue","value":143.8,"formatted":"$143.8B","color":"#3b82f6"}]}], "donutData": [{"label":"iPhone","value":"$196.5B","percent":54,"color":"#3b82f6"}], "centerLabel": {"primary":"$364.4B","secondary":"FY26 9mo"}, "progressSegments": [{"label":"Operating cash flow","value":"$117.0B","percent":85,"color":"#3b82f6"}], "treemapData": [{"label":"U.S.","value":591,"sublabel":"No. of locations","color":"#f6e7d7","group":"N. America"}], "treemapLegend": [{"label":"N. America","color":"#f6e7d7"}] } — treemap = proportional area blocks (market share, locations by region)
   - "feed_table": { "type": "feed_table", "title": "Recent Activity", "rows": [{"date":"Jul 30 '26","event":"Q4 guidance announced","amount":"$100.0B"}] }
   - "metric": { "type": "metric", "label": "Annual Run Rate", "value": "$4.28M", "delta": "+28.4% YoY", "deltaDirection": "up", "sparkline": [20,28,35,52,68], "icon": "activity" }
2. Swiss Editorial Mindmaps, Venn Timelines & S-Curves:
   - "mindmap": { "type": "mindmap", "steps": [{"number":"01","title":"Graphic design","subtitle":"concept","isTerminal":true}, {"number":"02","title":"Branches","branches":[{"side":"left","text":"font"},{"side":"right","text":"color"}]}, {"number":"03","title":"Venn","vennNodes":[{"label":"function","callout":"Target"},{"label":"mood","callout":"Emotion"}]}, {"number":"05","title":"Pills","pills":["idea sketch","idea meeting"]}] }
   - "scurve_timeline": { "type": "scurve_timeline", "title": "Project Steps", "subtitle": "INFOGRAPHICS TEMPLATE", "strokeColor": "#365f60", "steps": [{"stepNumber":"01","title":"Research","description":"...","hubColor":"#cf3c2e"}], "hasSilhouette": true }
   - "step_timeline": vertical alternating timeline poster. { "type": "step_timeline", "title": "Startup Timeline", "accentColor": "#1e3a8a", "steps": [{"label":"STEP 1","title":"Market Research","description":"..."}] } — steps alternate left/right of a center spine with numbered circle badges and dashed leaders. Use for roadmap/step infographics.
   - "venn_timeline": { "type": "venn_timeline", "title": "Concept Derivation", "nodes": [{"primaryText":"Brand Identity","subText":"Core Values","vennLabels":["Function","Form"],"branches":[{"text":"Typography","side":"left"},{"text":"Palette","side":"right"}],"color":"dark"}] }
   - "isometric_block": { "type": "isometric_block", "title": "Business Growth", "callouts": [{"number":"01","title":"Setup","description":"...","side":"left"}], "hasSilhouette": true }
3. System Architecture, Process Maps & HUDs:
   - "layered_process_map": { "type": "layered_process_map", "title": "Gastronomy Process", "zones": [{"id":"z1","label":"Mental & Emotional","color":"#eab308"}], "nodes": [{"id":"n1","zoneId":"z1","label":"Actors","icon":"people"}], "connections": [{"from":"n1","to":"n2","style":"solid","color":"#3b82f6"}] }
   - "tech_hud_panel": { "type": "tech_hud_panel", "title": "System Diagnostics", "gridItems": [{"label":"Sector Alpha","value":"12415251","barcode":true,"colSpan":2},{"label":"Target","crosshair":true,"rowSpan":2}] }
   - "dot_matrix": halftone / dithered / dot-density art. { "type": "dot_matrix", "rows": ["0123456789", "9876543210"], "dotColor": "#f8fafc", "background": "#0b0f19", "glyph": "circle" | "square" | "diamond" } — each row is a string; each character 0-9 (or " .:-=+*#%@") sets that cell's dot size. Use for dithered portraits, halftone gradients, retro dot charts, texture panels.
   - ASCII / terminal art: a plain "text" shape with "fontFamily": "'JetBrains Mono', monospace" and "wrap": false in its text block — every \n line renders verbatim, monospaced, so character art and terminal-style cards (dotted-border tables, ::::: bar charts) stay aligned. Set text.wrap false whenever exact character columns matter.
   - Inline emphasis: any shape's text.content may embed "**bold**", "*italic*", "==highlight==" markers for emphasis within a single block — no schema change, content stays a plain string (ignored when text.wrap is false).
   - "card": { "type": "card", "title": "API Gateway", "icon": "k8s"|"postgres"|"kafka"|"stripe"|"openai"|"aws", "badge": {"text":"INGRESS","bg":"#ecfdf5","color":"#047857"}, "subtitle": "...", "metadata": [{"label":"p99","value":"1.4ms"}] }
   - "pictogram": { "type": "pictogram", "icon": "lightbulb", "stroke": "#1a1a1a" } — 20 built-in line icons: person, people, lightbulb, gear, target, book, chart, palette, pyramid, grid, cursor, monitor, phone, search, cycle, star, shield, clock, dollar, speech. Use for icon-grid posters and callouts.
   - "pictogram_row": { "type": "pictogram_row", "icon": "person", "count": 10, "filled": 7, "color": "#e05252" } — human-graph rows ("7 in 10 people"), first \`filled\` icons colored, rest muted.
   - "table": { "type": "table", "tableName": "users", "columns": [{"name":"id","type":"uuid","isPk":true}, {"name":"email","type":"varchar"}] }
   - "image": { "type": "image", "src": "data:image/..." | "https://...", "width": 200, "height": 150 }
   - "rectangle" | "ellipse" | "diamond" | "cylinder" | "cloud" | "sticky" | "frame"
   - any shape: "shadow": false renders it flat (no drop shadow) — use across a whole diagram for a crisp technical/UML look, e.g. { "type": "rectangle", "width": 120, "height": 40, "shadow": false }
   - "arrow" | "line": { "start": {"shapeId":"id1","anchor":"auto"}, "end": {"shapeId":"id2","anchor":"auto"}, "routing": "orthogonal" | "curved" | "straight", "label": "...", "waypoints": [{"x":300,"y":150}], "showJunctions": true } — waypoints bend the connector through intermediate points; showJunctions draws small ring markers at each point — use for routed/dense diagrams with visible junctions.
     Head style (either end): "arrowHeadEnd" / "arrowHeadStart": "arrow" (default filled pointer) | "triangle-open" (hollow triangle — UML inheritance/"is a") | "diamond" (filled — UML composition/"owns") | "diamond-open" (hollow — UML aggregation/"has a") | "none". Example: { "type": "line", "start": {"shapeId":"subclass"}, "end": {"shapeId":"baseclass"}, "arrowHeadEnd": "triangle-open" }
     Label style: "labelStyle": "plain" drops the pill border/shadow and prints the label as bare text over a background knockout — use for classic flowchart/UML edge labels; omit (default "pill") for product/architecture diagrams.
   - "mesh_connector": { "type": "mesh_connector", "width": 400, "height": 200, "fromCount": 6, "toCount": 8, "orientation": "horizontal" } — dense many-to-many crosshatch of thin lines fanning between two groups of points, with dots at each point. Use for "all X connect to all Y" visualizations, network-density motifs, decorative connection fans in system/process maps. Not for real semantic connections (those are separate arrows) — this is a visual density/relationship-field motif.

RULES:
- Every shape needs a unique "id" (short, kebab-case, e.g. "rev_chart", "step1").
- Connectors between shapes MUST bind via endpoints: {"shapeId": "node1", "anchor": "auto"}.
- Use exact, rich domain values instead of generic placeholders.

DESIGN STANDARDS (fonts & color — follow these unless the user asks otherwise):
- Type pairing: editorial posters = serif display titles ("Georgia, 'Times New Roman', serif") + sans body; dashboards/UI = Inter throughout; terminal/technical = "'JetBrains Mono', monospace" with text.wrap false. Set fontSize deliberately: display 28-64, section titles 20-30, body 13-15, eyebrow/labels 10-12 uppercase.
- Palettes: pick ONE system per canvas — Editorial cream (#f5f2eb bg, #1a1a1a ink, one accent), Swiss primaries (white/#f0ede4 bg, cobalt #193497, red #e03a2f, black), Neon-on-dark (#0b0f19 bg, #f8fafc text, one neon accent), or Muted consulting (slate/indigo). Never mix systems; never default to random bright colors.
- Whitespace is structure: generous margins, aligned edges, consistent gaps. Repetition of one glyph family beats variety.`,
};

export const ANTI_GENERIC_DIRECTIVE = `
Avoid generic AI output — this is the most common failure mode, and it costs nothing to avoid:
- Don't default to the flattest, most obvious structure because it's safe. If the request implies a specific shape (a real approval chain with a rejection path, a data flow with real branches, an actual hierarchy), build that — not a generic straight-line or symmetric-tree fallback.
- Don't use placeholder-sounding labels ("Step 1", "Process A", "User", "Admin", "Service") when the prompt gives you enough to be specific. Name real entities, real service names, real role titles, real stage names.
- Make deliberate visual choices — grouping, color, emphasis, layout — instead of even-spacing/default-palette output. An unspecified detail is freedom to make a good call, not license to do the least possible.
- When a "textbook example" version and a "built for this specific request" version would look different, always build the specific one.
- **Standard Dashboard Practices**: Legends must be legible and properly aligned (left or bottom). Always include baselines and axes for charts. Do not use generic bright tailwind colors; use subtle, muted corporate palettes (like Apple Financials or McKinsey). Never let labels overlap; truncate or wrap them if necessary. Use metric sparklines with proper baseline grounding.`;

// ─── Large / complex diagram guidance ────────────────────────────────────────
// Freeform degrades into spaghetti past ~25 shapes. When the intent implies a
// big system, steer the model toward grouped, readable layouts.

export const GRAPH_STRUCTURED_TYPES: DiagramType[] = ["freeform"];

export function buildComplexityDirective(
  type: DiagramType,
  signal: { entities?: number; steps?: number; relationships?: number; detailLevel?: string },
): string {
  if (!GRAPH_STRUCTURED_TYPES.includes(type)) return "";
  const size = (signal.entities ?? 0) + (signal.steps ?? 0) + (signal.relationships ?? 0);
  const isLarge = size >= 8 || signal.detailLevel === "high";
  if (!isLarge) return "";

  return `
LARGE / COMPLEX DIAGRAM — this request implies many elements. Prioritize readability over completeness:
- Group related shapes inside labeled \`frame\` shapes so the structure reads as sections, not one flat mesh.
- Keep spacing uniform and minimize crossing connectors; prefer orthogonal routing for dense areas.
- Cap the diagram at roughly 25-30 nodes. If the system is larger, summarize leaf detail into representative nodes rather than drawing every item.
- Keep edge labels short (1-3 words). Avoid long chains of single-child nodes — collapse them.
- A clear, grouped diagram of the core flow beats an exhaustive tangle.
`;
}

export const DIAGRAM_TYPE_DEFAULTS: Record<DiagramType, string> = {
  freeform: JSON.stringify({
    version: 1,
    shapes: [
      { id: "frame1", type: "frame", name: "Ideas", x: 40, y: 40, width: 480, height: 260, text: { content: "Ideas" } },
      { id: "box1", type: "rectangle", name: "concept-a", x: 80, y: 120, width: 180, height: 90, fill: "5", frameId: "frame1", text: { content: "Concept A" } },
      { id: "box2", type: "rectangle", name: "concept-b", x: 320, y: 120, width: 180, height: 90, fill: "4", frameId: "frame1", text: { content: "Concept B" } },
      { id: "arrow1", type: "arrow", start: { shapeId: "box1", anchor: "auto" }, end: { shapeId: "box2", anchor: "auto" }, label: "leads to" },
      { id: "note1", type: "sticky", name: "reminder", x: 80, y: 340, width: 200, height: 140, fill: "3", text: { content: "Add more notes here" } },
    ],
  }),
};

// ---------------------------------------------------------------------------
// Use-case style conventions
// ---------------------------------------------------------------------------

export type UseCaseId = "presentation" | "social" | "documentation" | "custom";

/**
 * Per-use-case generation style instructions appended to the AI generation prompt.
 * "custom" is empty string — preserves existing behavior, no additional instruction.
 */
export const USE_CASE_STYLE_INSTRUCTIONS: Record<UseCaseId, string> = {
  presentation: `
Use-case style: PRESENTATION
- Target: slides, pitch decks, keynotes displayed on screen
- Nodes: maximum 5 top-level nodes; group sub-steps into subgraphs instead of expanding every detail
- Labels: short, bold, action-oriented (2-4 words max per node label)
- Edges: minimal annotations; use edge labels only when the transition is non-obvious
- Density: LOW — prioritize visual clarity and whitespace over completeness
- Rule: if the user's prompt would produce more than 6 top-level nodes at medium density, consolidate related nodes into labeled subgraphs`,

  social: `
Use-case style: SOCIAL MEDIA
- Target: Instagram, LinkedIn, Twitter/X — small screen, fast scan
- Nodes: maximum 4 main elements — cut everything else
- Labels: bold, punchy, reader-friendly (no technical jargon unless asked)
- Edges: use simple, clean connectors with no annotations
- Density: VERY LOW — high visual impact, minimal text
- Shapes: prefer rounded/friendly shapes where diagram type allows`,

  documentation: `
Use-case style: DOCUMENTATION
- Target: READMEs, technical docs, wikis, API references
- Nodes: extract ALL named entities, steps, actors, and relationships from the prompt — omit nothing
- Labels: descriptive and precise; include type annotations, method names, or data field names where relevant
- Edges: annotate every edge with the action, condition, or data flowing across it
- Density: HIGH — accuracy and completeness over visual simplicity
- Sub-steps: expand all nested processes; use subgraphs to organize without hiding information`,

  custom: "",
};
