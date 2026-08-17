import { generateShapeId, type CanvasShape } from "./freeform-canvas.ts";

// Single source of truth for "what does a blank X look like when a human places
// one by hand." Before this file, only the AI could emit the 20 macro shapes —
// there was no starter content for a human to click a toolbar button and get a
// valid card/dashboard/chart/mindmap/etc. This is pure data (no JSX), so any
// toolbar flyout, hover-connector picker, or sidebar can share one catalog
// instead of re-inventing default content per surface.

export type ShapeCategory =
  | "basic"
  | "containers"
  | "cards"
  | "data"
  | "narrative"
  | "decorative";

export const SHAPE_CATEGORIES: { id: ShapeCategory; label: string }[] = [
  { id: "basic", label: "Basic Shapes" },
  { id: "containers", label: "Containers & Text" },
  { id: "cards", label: "Cards & Tables" },
  { id: "data", label: "Data & Charts" },
  { id: "narrative", label: "Narrative Layouts" },
  { id: "decorative", label: "Decorative" },
];

export type ShapeCatalogEntry = {
  type: CanvasShape["type"];
  label: string;
  category: ShapeCategory;
  description: string;
  icon: string; // lucide-react icon name — consuming UI resolves it
  defaultSize: { width: number; height: number };
  build: (cx: number, cy: number) => CanvasShape;
};

function centered(cx: number, cy: number, w: number, h: number) {
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) };
}

export const SHAPE_CATALOG: ShapeCatalogEntry[] = [
  // ─── Basic ───────────────────────────────────────────────────────────────
  {
    type: "rectangle",
    label: "Rectangle",
    category: "basic",
    description: "General-purpose box",
    icon: "Square",
    defaultSize: { width: 160, height: 90 },
    build: (cx, cy) => ({
      id: generateShapeId("r"),
      type: "rectangle",
      ...centered(cx, cy, 160, 90),
      width: 160,
      height: 90,
      fill: "#ffffff",
      stroke: "#334155",
      strokeWidth: 2,
      cornerRadius: 8,
      text: { content: "", fontSize: 14, align: "center" },
    }),
  },
  {
    type: "diamond",
    label: "Diamond",
    category: "basic",
    description: "Decision / branch point",
    icon: "Diamond",
    defaultSize: { width: 160, height: 100 },
    build: (cx, cy) => ({
      id: generateShapeId("d"),
      type: "diamond",
      ...centered(cx, cy, 160, 100),
      width: 160,
      height: 100,
      fill: "#ffffff",
      stroke: "#334155",
      strokeWidth: 2,
      text: { content: "", fontSize: 13, align: "center" },
    }),
  },
  {
    type: "ellipse",
    label: "Ellipse",
    category: "basic",
    description: "Start/end terminator",
    icon: "Circle",
    defaultSize: { width: 160, height: 90 },
    build: (cx, cy) => ({
      id: generateShapeId("e"),
      type: "ellipse",
      ...centered(cx, cy, 160, 90),
      width: 160,
      height: 90,
      fill: "#ffffff",
      stroke: "#334155",
      strokeWidth: 2,
      text: { content: "", fontSize: 14, align: "center" },
    }),
  },
  {
    type: "triangle",
    label: "Triangle",
    category: "basic",
    description: "Directional / warning marker",
    icon: "Triangle",
    defaultSize: { width: 160, height: 120 },
    build: (cx, cy) => ({
      id: generateShapeId("t"),
      type: "triangle",
      ...centered(cx, cy, 160, 120),
      width: 160,
      height: 120,
      fill: "#ffffff",
      stroke: "#334155",
      strokeWidth: 2,
      text: { content: "", fontSize: 13, align: "center" },
    }),
  },
  {
    type: "cylinder",
    label: "Database",
    category: "basic",
    description: "Storage / database symbol",
    icon: "Database",
    defaultSize: { width: 160, height: 120 },
    build: (cx, cy) => ({
      id: generateShapeId("c"),
      type: "cylinder",
      ...centered(cx, cy, 160, 120),
      width: 160,
      height: 120,
      fill: "#ffffff",
      stroke: "#334155",
      strokeWidth: 2,
      text: { content: "Database", fontSize: 13, align: "center" },
    }),
  },
  {
    type: "cloud",
    label: "Cloud",
    category: "basic",
    description: "External system / cloud service",
    icon: "Cloud",
    defaultSize: { width: 180, height: 110 },
    build: (cx, cy) => ({
      id: generateShapeId("cl"),
      type: "cloud",
      ...centered(cx, cy, 180, 110),
      width: 180,
      height: 110,
      fill: "#ffffff",
      stroke: "#334155",
      strokeWidth: 2,
      text: { content: "", fontSize: 13, align: "center" },
    }),
  },
  {
    type: "hexagon",
    label: "Hexagon",
    category: "basic",
    description: "Process / preparation step",
    icon: "Hexagon",
    defaultSize: { width: 160, height: 110 },
    build: (cx, cy) => ({
      id: generateShapeId("h"),
      type: "hexagon",
      ...centered(cx, cy, 160, 110),
      width: 160,
      height: 110,
      fill: "#ffffff",
      stroke: "#334155",
      strokeWidth: 2,
      text: { content: "", fontSize: 13, align: "center" },
    }),
  },
  {
    type: "star",
    label: "Star",
    category: "basic",
    description: "Highlight / callout marker",
    icon: "Star",
    defaultSize: { width: 130, height: 130 },
    build: (cx, cy) => ({
      id: generateShapeId("s"),
      type: "star",
      ...centered(cx, cy, 130, 130),
      width: 130,
      height: 130,
      fill: "#fbbf24",
      stroke: "#d97706",
      strokeWidth: 2,
      text: { content: "", fontSize: 12, align: "center" },
    }),
  },

  // ─── Containers & Text ───────────────────────────────────────────────────
  {
    type: "sticky",
    label: "Sticky Note",
    category: "containers",
    description: "Free-form note",
    icon: "StickyNote",
    defaultSize: { width: 180, height: 180 },
    build: (cx, cy) => ({
      id: generateShapeId("st"),
      type: "sticky",
      ...centered(cx, cy, 180, 180),
      width: 180,
      height: 180,
      fill: "#fef08a",
      text: { content: "", fontSize: 14 },
    }),
  },
  {
    type: "text",
    label: "Text",
    category: "containers",
    description: "Plain text label",
    icon: "Type",
    defaultSize: { width: 140, height: 36 },
    build: (cx, cy) => ({
      id: generateShapeId("tx"),
      type: "text",
      ...centered(cx, cy, 140, 36),
      width: 140,
      height: 36,
      text: { content: "", fontSize: 14, align: "left" },
    }),
  },
  {
    type: "frame",
    label: "Frame",
    category: "containers",
    description: "Named container / section",
    icon: "Frame",
    defaultSize: { width: 440, height: 320 },
    build: (cx, cy) => ({
      id: generateShapeId("f"),
      type: "frame",
      ...centered(cx, cy, 440, 320),
      width: 440,
      height: 320,
      name: "Frame",
    }),
  },
  {
    type: "image",
    label: "Image",
    category: "containers",
    description: "Upload a picture",
    icon: "ImagePlus",
    defaultSize: { width: 300, height: 200 },
    build: (cx, cy) => ({
      id: generateShapeId("img"),
      type: "image",
      ...centered(cx, cy, 300, 200),
      width: 300,
      height: 200,
      src: "",
      objectFit: "cover",
    }),
  },

  // ─── Cards & Tables ──────────────────────────────────────────────────────
  {
    type: "card",
    label: "Card",
    category: "cards",
    description: "Titled panel with an icon, badge and body copy",
    icon: "IdCard",
    defaultSize: { width: 280, height: 160 },
    build: (cx, cy) => ({
      id: generateShapeId("card"),
      type: "card",
      ...centered(cx, cy, 280, 160),
      width: 280,
      height: 160,
      icon: "server",
      title: "New Card",
      subtitle: "",
      text: { content: "Describe this step or component." },
    }),
  },
  {
    type: "table",
    label: "Database Table",
    category: "cards",
    description: "Schema table with typed columns",
    icon: "Table2",
    defaultSize: { width: 260, height: 180 },
    build: (cx, cy) => ({
      id: generateShapeId("tbl"),
      type: "table",
      ...centered(cx, cy, 260, 180),
      width: 260,
      height: 180,
      tableName: "table_name",
      columns: [
        { name: "id", type: "uuid", isPk: true },
        { name: "created_at", type: "timestamp" },
        { name: "name", type: "text" },
      ],
    }),
  },
  {
    type: "feed_table",
    label: "Activity Feed",
    category: "cards",
    description: "Dated row list (events, transactions, changelogs)",
    icon: "ListOrdered",
    defaultSize: { width: 320, height: 220 },
    build: (cx, cy) => ({
      id: generateShapeId("feed"),
      type: "feed_table",
      ...centered(cx, cy, 320, 220),
      width: 320,
      height: 220,
      title: "Recent Activity",
      rows: [
        { date: "Today", event: "New event" },
        { date: "Yesterday", event: "Another event" },
      ],
    }),
  },
  {
    type: "mockup",
    label: "Device Mockup",
    category: "cards",
    description: "Browser, laptop or phone frame",
    icon: "Monitor",
    defaultSize: { width: 360, height: 240 },
    build: (cx, cy) => ({
      id: generateShapeId("mock"),
      type: "mockup",
      ...centered(cx, cy, 360, 240),
      width: 360,
      height: 240,
      mockupType: "browser",
      title: "New Page",
    }),
  },

  // ─── Data & Charts ───────────────────────────────────────────────────────
  {
    type: "metric",
    label: "Metric Tile",
    category: "data",
    description: "Single KPI with a delta and sparkline",
    icon: "Gauge",
    defaultSize: { width: 200, height: 120 },
    build: (cx, cy) => ({
      id: generateShapeId("met"),
      type: "metric",
      ...centered(cx, cy, 200, 120),
      width: 200,
      height: 120,
      label: "Metric",
      value: "0",
    }),
  },
  {
    type: "dashboard",
    label: "Dashboard Panel",
    category: "data",
    description: "Windowed panel with tabs and actions",
    icon: "LayoutDashboard",
    defaultSize: { width: 420, height: 280 },
    build: (cx, cy) => ({
      id: generateShapeId("dash"),
      type: "dashboard",
      ...centered(cx, cy, 420, 280),
      width: 420,
      height: 280,
      title: "Dashboard",
    }),
  },
  {
    type: "chart",
    label: "Chart",
    category: "data",
    description: "Bar, line, donut, or treemap chart",
    icon: "BarChart3",
    defaultSize: { width: 360, height: 260 },
    build: (cx, cy) => ({
      id: generateShapeId("chart"),
      type: "chart",
      ...centered(cx, cy, 360, 260),
      width: 360,
      height: 260,
      title: "Chart Title",
      chartType: "bar",
      data: [
        { label: "A", value: 40 },
        { label: "B", value: 65 },
        { label: "C", value: 30 },
      ],
    }),
  },

  // ─── Narrative Layouts ───────────────────────────────────────────────────
  {
    type: "mindmap",
    label: "Mindmap",
    category: "narrative",
    description: "Branching step sequence",
    icon: "GitBranch",
    defaultSize: { width: 480, height: 320 },
    build: (cx, cy) => ({
      id: generateShapeId("mind"),
      type: "mindmap",
      ...centered(cx, cy, 480, 320),
      width: 480,
      height: 320,
      title: "Mindmap",
      steps: [
        { number: "1", title: "First idea" },
        { number: "2", title: "Second idea" },
      ],
    }),
  },
  {
    type: "scurve_timeline",
    label: "S-Curve Timeline",
    category: "narrative",
    description: "Roadmap with a connecting S-curve",
    icon: "TrendingUp",
    defaultSize: { width: 560, height: 260 },
    build: (cx, cy) => ({
      id: generateShapeId("scurve"),
      type: "scurve_timeline",
      ...centered(cx, cy, 560, 260),
      width: 560,
      height: 260,
      title: "Roadmap",
      steps: [
        { stepNumber: "1", title: "Phase one", description: "" },
        { stepNumber: "2", title: "Phase two", description: "" },
        { stepNumber: "3", title: "Phase three", description: "" },
      ],
    }),
  },
  {
    type: "step_timeline",
    label: "Step Timeline",
    category: "narrative",
    description: "Simple horizontal numbered steps",
    icon: "ListChecks",
    defaultSize: { width: 520, height: 140 },
    build: (cx, cy) => ({
      id: generateShapeId("steps"),
      type: "step_timeline",
      ...centered(cx, cy, 520, 140),
      width: 520,
      height: 140,
      title: "Process",
      steps: [
        { title: "Step one" },
        { title: "Step two" },
        { title: "Step three" },
      ],
    }),
  },
  {
    type: "isometric_block",
    label: "Isometric Block",
    category: "narrative",
    description: "3D block with numbered callouts",
    icon: "Box",
    defaultSize: { width: 420, height: 320 },
    build: (cx, cy) => ({
      id: generateShapeId("iso"),
      type: "isometric_block",
      ...centered(cx, cy, 420, 320),
      width: 420,
      height: 320,
      title: "System Overview",
      callouts: [
        { number: "1", title: "Layer one", description: "" },
        { number: "2", title: "Layer two", description: "" },
      ],
    }),
  },
  {
    type: "venn_timeline",
    label: "Venn Concept Tree",
    category: "narrative",
    description: "Overlapping-circle concept map",
    icon: "CircleDot",
    defaultSize: { width: 420, height: 360 },
    build: (cx, cy) => ({
      id: generateShapeId("venn"),
      type: "venn_timeline",
      ...centered(cx, cy, 420, 360),
      width: 420,
      height: 360,
      title: "Concept Map",
      nodes: [
        { primaryText: "Concept A" },
        { primaryText: "Concept B" },
      ],
    }),
  },
  {
    type: "tech_hud_panel",
    label: "Tech HUD Panel",
    category: "narrative",
    description: "Dense telemetry-style grid",
    icon: "LayoutGrid",
    defaultSize: { width: 420, height: 300 },
    build: (cx, cy) => ({
      id: generateShapeId("hud"),
      type: "tech_hud_panel",
      ...centered(cx, cy, 420, 300),
      width: 420,
      height: 300,
      title: "System Status",
      gridItems: [
        { label: "STATUS", value: "OK" },
        { label: "UPTIME", value: "99.9%" },
      ],
    }),
  },
  {
    type: "layered_process_map",
    label: "Layered Process Map",
    category: "narrative",
    description: "Multi-zone process map with routed connections",
    icon: "Workflow",
    defaultSize: { width: 560, height: 360 },
    build: (cx, cy) => ({
      id: generateShapeId("lpm"),
      type: "layered_process_map",
      ...centered(cx, cy, 560, 360),
      width: 560,
      height: 360,
      title: "Process Map",
      zones: [{ id: "z1", label: "Zone 1" }],
      nodes: [{ id: "n1", zoneId: "z1", label: "Step" }],
      connections: [],
    }),
  },

  // ─── Decorative ──────────────────────────────────────────────────────────
  {
    type: "pictogram",
    label: "Pictogram",
    category: "decorative",
    description: "Single icon glyph",
    icon: "Shapes",
    defaultSize: { width: 60, height: 60 },
    build: (cx, cy) => ({
      id: generateShapeId("pic"),
      type: "pictogram",
      ...centered(cx, cy, 60, 60),
      width: 60,
      height: 60,
      icon: "user",
    }),
  },
  {
    type: "pictogram_row",
    label: "Pictogram Row",
    category: "decorative",
    description: "Repeated icons showing a fill ratio (e.g. 7 of 10)",
    icon: "Users",
    defaultSize: { width: 260, height: 50 },
    build: (cx, cy) => ({
      id: generateShapeId("picrow"),
      type: "pictogram_row",
      ...centered(cx, cy, 260, 50),
      width: 260,
      height: 50,
      icon: "user",
      count: 10,
      filled: 7,
    }),
  },
  {
    type: "dot_matrix",
    label: "Dot Matrix",
    category: "decorative",
    description: "Halftone density grid",
    icon: "Grid3x3",
    defaultSize: { width: 200, height: 120 },
    build: (cx, cy) => ({
      id: generateShapeId("dots"),
      type: "dot_matrix",
      ...centered(cx, cy, 200, 120),
      width: 200,
      height: 120,
      rows: ["13579753", "24680864", "13579753"],
    }),
  },
];

export function getCatalogEntry(type: CanvasShape["type"]): ShapeCatalogEntry | undefined {
  return SHAPE_CATALOG.find((e) => e.type === type);
}

export function catalogByCategory(category: ShapeCategory): ShapeCatalogEntry[] {
  return SHAPE_CATALOG.filter((e) => e.category === category);
}
