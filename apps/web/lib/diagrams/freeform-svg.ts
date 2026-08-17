import { resolveBrandIcon } from "./brand-icons.ts";
import {
  type CanvasDocument,
  type CanvasShape,
  type ArrowShape,
  type PathShape,
  type RectShape,
  type CardShape,
  type TableShape,
  type ImageShape,
  type MetricShape,
  type DashboardShape,
  type ChartShape,
  type FeedTableShape,
  type MindmapShape,
  type SCurveTimelineShape,
  type StepTimelineShape,
  type IsometricBlockShape,
  type MockupShape,
  type VennTimelineShape,
  type TechHudPanelShape,
  type LayeredProcessMapShape,
  type DotMatrixShape,
  type PictogramShape,
  type PictogramRowShape,
  type MeshConnectorShape,
  resolveArrowRenderEndpoints,
  getShapeBounds,
  resolveColor,
  isBoundEndpoint,
  resolveArrowHeadStyle,
  computeArrowHeadGeometry,
  wrapTextLines,
  fitTextFontSize,
} from "./freeform-canvas.ts";
import { getStroke } from "perfect-freehand";
import {
  hasRichTextMarkers,
  layoutRichTextLines,
  measureRunWidth,
  RICH_TEXT_HIGHLIGHT_FILL,
  RICH_TEXT_HIGHLIGHT_OPACITY,
} from "./rich-text.ts";

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Only handles #rgb/#rrggbb — non-hex accent colors (named colors, palette tokens) pass through unchanged.
function darkenHex(hex: string, amount = 0.25): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const full = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const r = Math.round(parseInt(full.slice(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(full.slice(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(full.slice(4, 6), 16) * (1 - amount));
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

// WCAG relative luminance — picks readable text color per treemap cell fill.
function textColorForFill(hex: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#1e2a3a";
  const full = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const luminance = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return luminance > 0.5 ? "#1e2a3a" : "#ffffff";
}

// ─── Real Multi-Color Cloud & Tech Brand Icons ──────────────────────────────
export function getSvgIcon(iconName: string, size = 16, color = "#4A85F6"): string {
  const norm = iconName.toLowerCase().replace(/[^a-z0-9-]/g, "");
  switch (norm) {
    case "aws":
      return `<path d="M18.8 15.5c-2.4 1.8-5.8 2.7-8.8 2.7-4.2 0-8-1.5-10.9-4-.2-.2 0-.5.3-.3 3.1 1.8 6.9 2.8 10.7 2.8 2.7 0 5.6-.6 8.3-1.8.4-.2.7.2.4.6z" fill="#FF9900"/><path d="M19.8 14.3c-.3-.4-2-.2-3 0-.3.1-.3-.2 0-.4 1.8-1.3 4.7-.9 5-.4.3.4-.2 3.3-1.8 4.7-.3.2-.5.1-.4-.2.5-.9.4-3.3.2-3.7z" fill="#FF9900"/>`;
    case "lambda":
      return `<path d="M7 21l6-18h4l-6 18h-4z" fill="#FF9900"/><path d="M4 21l4.5-10.5 3 4.5-3 6H4z" fill="#FF9900"/>`;
    case "s3":
      return `<path d="M12 2L3 6v12l9 4 9-4V6l-9-4zm0 2.2l6.5 2.9L12 10 5.5 7.1 12 4.2zM5 8.7l6 2.7v7.9l-6-2.7V8.7zm8 10.6v-7.9l6-2.7v7.9l-6 2.7z" fill="#E25822"/>`;
    case "kubernetes":
    case "k8s":
      return `<path d="M12 2l8.5 4.9v9.8L12 21.6l-8.5-4.9V6.9L12 2z" fill="none" stroke="#326CE5" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#326CE5"/><path d="M12 5v4M12 15v4M6 8.5l3.5 2M14.5 13.5l3.5 2M6 15.5l3.5-2M14.5 10.5l3.5-2" stroke="#326CE5" stroke-width="1.5"/>`;
    case "docker":
      return `<path d="M22 13c-.3-1.8-1.5-3-3.2-3.5-.3-.1-.5-.1-.8-.1-.4-.8-1.1-1.4-2-1.6-.2 0-.4-.1-.6-.1-.5-1.5-1.9-2.7-3.6-2.7h-1v5H2v6c0 3.3 2.7 6 6 6h8c3.9 0 7-3.1 7-7 0-.3 0-.7-.1-1.1.7-.4 1.1-.9 1.1-1.5z" fill="#2496ED"/><rect x="4" y="9" width="2" height="2" fill="#fff"/><rect x="7" y="9" width="2" height="2" fill="#fff"/><rect x="10" y="9" width="2" height="2" fill="#fff"/><rect x="7" y="6.5" width="2" height="2" fill="#fff"/><rect x="10" y="6.5" width="2" height="2" fill="#fff"/>`;
    case "cloudflare":
      return `<path d="M18.2 16.5H6.5a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.8-1.5A4.5 4.5 0 0 1 21 11.5a4.5 4.5 0 0 1-2.8 5z" fill="#F38020"/>`;
    case "react":
      return `<ellipse cx="12" cy="12" rx="3.5" ry="9" transform="rotate(30 12 12)" fill="none" stroke="#61DAFB" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="3.5" ry="9" transform="rotate(90 12 12)" fill="none" stroke="#61DAFB" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="3.5" ry="9" transform="rotate(150 12 12)" fill="none" stroke="#61DAFB" stroke-width="1.5"/><circle cx="12" cy="12" r="1.8" fill="#61DAFB"/>`;
    case "nextjs":
      return `<circle cx="12" cy="12" r="10" fill="#000"/><path d="M15 8v8M9 8v8l7.5-9" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`;
    case "postgres":
    case "postgresql":
      return `<path d="M12 3c-4.5 0-8 3-8 7 0 3 2 5.5 5 6.5v2.5l3-1.5 3 1.5V16.5c3-1 5-3.5 5-6.5 0-4-3.5-7-8-7z" fill="#336791"/><circle cx="9.5" cy="9.5" r="1" fill="#fff"/><circle cx="14.5" cy="9.5" r="1" fill="#fff"/>`;
    case "redis":
      return `<path d="M3 8l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4" fill="none" stroke="#DC382D" stroke-width="2" stroke-linejoin="round"/>`;
    case "kafka":
      return `<circle cx="12" cy="12" r="9" fill="#231F20"/><circle cx="12" cy="7" r="2" fill="#fff"/><circle cx="7.5" cy="14.5" r="2" fill="#fff"/><circle cx="16.5" cy="14.5" r="2" fill="#fff"/><path d="M12 7l-4.5 7.5M12 7l4.5 7.5" stroke="#fff" stroke-width="1.5"/>`;
    case "snowflake":
      return `<path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5" stroke="#29B5E8" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="#29B5E8"/>`;
    case "graphql":
      return `<path d="M12 2l8.7 5v10L12 22l-8.7-5V7L12 2z" fill="none" stroke="#E10098" stroke-width="1.5"/><circle cx="12" cy="2" r="2" fill="#E10098"/><circle cx="20.7" cy="7" r="2" fill="#E10098"/><circle cx="20.7" cy="17" r="2" fill="#E10098"/><circle cx="12" cy="22" r="2" fill="#E10098"/><circle cx="3.3" cy="17" r="2" fill="#E10098"/><circle cx="3.3" cy="7" r="2" fill="#E10098"/><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="#E10098" stroke-width="1"/>`;
    case "stripe":
      return `<rect x="2" y="4" width="20" height="16" rx="4" fill="#635BFF"/><path d="M10.8 11.2c0-.6.5-.9 1.4-.9 1.2 0 2.5.4 3.4 1v-2.7c-1.1-.4-2.3-.6-3.4-.6-2.7 0-4.6 1.4-4.6 3.9 0 3.7 5.1 3.1 5.1 4.7 0 .8-.7 1-1.6 1-1.4 0-3-.6-4.1-1.3v2.8c1.3.6 2.7.8 4.1.8 2.8 0 4.8-1.4 4.8-4 0-4-5.1-3.3-5.1-4.7z" fill="#fff"/>`;
    case "openai":
      return `<path d="M12 2a4 4 0 0 1 3.8 2.7l.2.8.8-.2a4 4 0 0 1 4.7 2.7l.2.8.7.4a4 4 0 0 1 1.7 5l-.4.7.4.7a4 4 0 0 1-1.7 5l-.7.4-.2.8a4 4 0 0 1-4.7 2.7l-.8-.2-.2.8a4 4 0 0 1-7.6 0l-.2-.8-.8.2a4 4 0 0 1-4.7-2.7l-.2-.8-.7-.4a4 4 0 0 1-1.7-5l.4-.7-.4-.7a4 4 0 0 1 1.7-5l.7-.4.2-.8a4 4 0 0 1 4.7-2.7l.8.2.2-.8A4 4 0 0 1 12 2z" fill="none" stroke="#10A37F" stroke-width="1.8"/>`;
    case "activity":
    case "analytics":
      return `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "chart":
      return `<line x1="18" y1="20" x2="18" y2="10" stroke="${color}" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="20" x2="12" y2="4" stroke="${color}" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="20" x2="6" y2="14" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
    default: {
      // 56 real vendor logos (Databricks, Snowflake, Kubernetes, Postgres, …)
      // drawn in their own brand color, so an unrecognized service name lands on
      // its actual mark instead of a meaningless generic glyph.
      const brand = resolveBrandIcon(iconName);
      if (brand) return `<path d="${brand.path}" fill="#${brand.hex}"/>`;
      return `<rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="${color}" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="${color}"/>`;
    }
  }
}

// Card body copy sits below the header, subtitle and metadata rows. Offsets are
// mirrored in freeform-renderer.tsx so canvas and export stay in agreement.
function cardBodyTspans(
  card: CardShape,
  content: string | undefined,
  x: number,
  y: number,
  w: number,
  color: string
): string {
  if (!content) return "";
  const metaRows = card.metadata?.length ?? 0;
  const metaTop = card.subtitle ? 78 : 60;
  const top = metaRows > 0 ? metaTop + metaRows * 18 + 6 : card.subtitle ? 74 : 54;

  const fontSize = 11.5;
  const maxChars = Math.max(4, Math.floor((w - 24) / (fontSize * 0.55)));
  const lines = content.split("\n").flatMap((raw) => {
    if (raw.length <= maxChars) return [raw];
    const out: string[] = [];
    let cur = "";
    for (const word of raw.split(" ")) {
      const candidate = cur ? `${cur} ${word}` : word;
      if (candidate.length > maxChars && cur) {
        out.push(cur);
        cur = word;
      } else {
        cur = candidate;
      }
    }
    if (cur) out.push(cur);
    return out;
  });

  const tspans = lines
    .map((line, idx) => `<tspan x="${x + 12}" y="${Math.round(y + top + fontSize + idx * fontSize * 1.35)}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<text xml:space="preserve" font-family="Inter, -apple-system, sans-serif" font-size="${fontSize}" fill="${color}">${tspans}</text>`;
}

// ─── Pictogram Icon Set (Lucide-style, 24x24, stroke-based fragments) ───────
function getPictogram(name: string): string {
  const norm = name.toLowerCase().replace(/[^a-z0-9-]/g, "");
  switch (norm) {
    case "person":
      return `<circle cx="12" cy="8" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/>`;
    case "people":
      return `<circle cx="9" cy="7" r="4"/><path d="M1 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>`;
    case "lightbulb":
      return `<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>`;
    case "gear":
      return `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>`;
    case "target":
      return `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`;
    case "book":
      return `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`;
    case "chart":
      return `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`;
    case "palette":
      return `<path d="M12 22a10 10 0 1 1 10-10 4 4 0 0 1-4 4h-1.5a1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 .5 1.1 1.5 1.5 0 0 1 .5 1.1c0 1-1 1.9-2 2Z"/><circle cx="6.5" cy="11.5" r="1.5"/><circle cx="9.5" cy="7.5" r="1.5"/><circle cx="14.5" cy="7.5" r="1.5"/><circle cx="17.5" cy="11.5" r="1.5"/>`;
    case "pyramid":
      return `<path d="M12 3L3 21h18L12 3z"/><path d="M7.2 15h9.6M5.4 18.5h13.2"/>`;
    case "grid":
      return `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>`;
    case "cursor":
      return `<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/>`;
    case "monitor":
      return `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`;
    case "phone":
      return `<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`;
    case "search":
      return `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`;
    case "cycle":
      return `<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`;
    case "star":
      return `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`;
    case "shield":
      return `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`;
    case "clock":
      return `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`;
    case "dollar":
      return `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`;
    case "speech":
      return `<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>`;
    default:
      return `<circle cx="12" cy="8" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/>`;
  }
}

// ─── Silhouette Human Figure Vector ─────────────────────────────────────────
function getSilhouetteFigure(x: number, y: number, height = 36, scale = 1): string {
  const s = scale * (height / 40);
  return `
    <g transform="translate(${x}, ${y}) scale(${s})">
      <!-- Ground Cast Shadow -->
      <polygon points="0,38 35,46 15,38 -10,38" fill="rgba(0,0,0,0.22)" />
      <!-- Head -->
      <circle cx="0" cy="5" r="3.5" fill="#0f172a" />
      <!-- Body & Limbs -->
      <path d="M -3 10 C -3 9 3 9 3 10 L 4 22 L 2 36 L -1 36 L 0 24 L -2 36 L -5 36 L -2 22 Z" fill="#0f172a" />
      <!-- Walking Arms -->
      <path d="M -3 12 L -6 20 L -4 21 L -1 13" fill="#0f172a" />
      <path d="M 3 12 L 6 19 L 4 20 L 1 13" fill="#0f172a" />
    </g>`;
}

// ─── Obstacle Clearance Manhattan Router ────────────────────────────────────
function computeObstacleAwarePath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startAnchor?: string,
  endAnchor?: string,
  filletRadius = 8
): { pathD: string; waypoints: { x: number; y: number }[] } {
  const waypoints: { x: number; y: number }[] = [{ x: start.x, y: start.y }];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    waypoints.push({ x: end.x, y: end.y });
    return { pathD: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, waypoints };
  }

  const clearance = 24;

  if (startAnchor === "top") {
    waypoints.push({ x: start.x, y: start.y - clearance });
    if (endAnchor === "bottom" && dy < 0) {
      const midY = Math.round((start.y - clearance + end.y + clearance) / 2);
      waypoints.push({ x: start.x, y: midY });
      waypoints.push({ x: end.x, y: midY });
    } else if (endAnchor === "left" || endAnchor === "right") {
      waypoints.push({ x: start.x, y: end.y });
    } else {
      const midX = Math.round((start.x + end.x) / 2);
      waypoints.push({ x: midX, y: start.y - clearance });
      waypoints.push({ x: midX, y: end.y });
    }
  } else if (startAnchor === "bottom") {
    waypoints.push({ x: start.x, y: start.y + clearance });
    if (endAnchor === "top" && dy > 0) {
      const midY = Math.round((start.y + clearance + end.y - clearance) / 2);
      waypoints.push({ x: start.x, y: midY });
      waypoints.push({ x: end.x, y: midY });
    } else if (endAnchor === "left" || endAnchor === "right") {
      waypoints.push({ x: start.x, y: end.y });
    } else {
      const midX = Math.round((start.x + end.x) / 2);
      waypoints.push({ x: midX, y: start.y + clearance });
      waypoints.push({ x: midX, y: end.y });
    }
  } else if (startAnchor === "left") {
    waypoints.push({ x: start.x - clearance, y: start.y });
    if (endAnchor === "right" && dx < 0) {
      const midX = Math.round((start.x - clearance + end.x + clearance) / 2);
      waypoints.push({ x: midX, y: start.y });
      waypoints.push({ x: midX, y: end.y });
    } else if (endAnchor === "top" || endAnchor === "bottom") {
      waypoints.push({ x: end.x, y: start.y });
    } else {
      const midY = Math.round((start.y + end.y) / 2);
      waypoints.push({ x: start.x - clearance, y: midY });
      waypoints.push({ x: end.x, y: midY });
    }
  } else if (startAnchor === "right") {
    waypoints.push({ x: start.x + clearance, y: start.y });
    if (endAnchor === "left" && dx > 0) {
      const midX = Math.round((start.x + clearance + end.x - clearance) / 2);
      waypoints.push({ x: midX, y: start.y });
      waypoints.push({ x: midX, y: end.y });
    } else if (endAnchor === "top" || endAnchor === "bottom") {
      waypoints.push({ x: end.x, y: start.y });
    } else {
      const midY = Math.round((start.y + end.y) / 2);
      waypoints.push({ x: start.x + clearance, y: midY });
      waypoints.push({ x: end.x, y: midY });
    }
  } else {
    const midX = Math.round((start.x + end.x) / 2);
    waypoints.push({ x: midX, y: start.y });
    waypoints.push({ x: midX, y: end.y });
  }

  waypoints.push({ x: end.x, y: end.y });

  let pathD = `M ${waypoints[0].x} ${waypoints[0].y}`;
  for (let i = 1; i < waypoints.length - 1; i++) {
    const pPrev = waypoints[i - 1];
    const pCurr = waypoints[i];
    const pNext = waypoints[i + 1];

    const d1x = pCurr.x - pPrev.x;
    const d1y = pCurr.y - pPrev.y;
    const len1 = Math.hypot(d1x, d1y);

    const d2x = pNext.x - pCurr.x;
    const d2y = pNext.y - pCurr.y;
    const len2 = Math.hypot(d2x, d2y);

    const r = Math.min(filletRadius, len1 / 2, len2 / 2);

    if (len1 < 1 || len2 < 1 || r < 1) {
      pathD += ` L ${pCurr.x} ${pCurr.y}`;
      continue;
    }

    const pStartTurn = {
      x: pCurr.x - (d1x / len1) * r,
      y: pCurr.y - (d1y / len1) * r,
    };
    const pEndTurn = {
      x: pCurr.x + (d2x / len2) * r,
      y: pCurr.y + (d2y / len2) * r,
    };

    pathD += ` L ${Math.round(pStartTurn.x)} ${Math.round(pStartTurn.y)}`;
    pathD += ` Q ${pCurr.x} ${pCurr.y} ${Math.round(pEndTurn.x)} ${Math.round(pEndTurn.y)}`;
  }
  pathD += ` L ${waypoints[waypoints.length - 1].x} ${waypoints[waypoints.length - 1].y}`;

  return { pathD, waypoints };
}

// Runs the obstacle-aware bend logic across every consecutive pair in a multi-point
// route (waypoints), stitching the per-segment paths so multi-bend arrows stay orthogonal
// along the whole route rather than only between the raw start and end.
function computeObstacleAwarePathMulti(
  points: { x: number; y: number }[],
  startAnchor?: string,
  endAnchor?: string,
  filletRadius = 8
): { pathD: string; waypoints: { x: number; y: number }[] } {
  if (points.length < 2) return { pathD: "", waypoints: points };
  let pathD = "";
  const waypoints: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const segStartAnchor = i === 0 ? startAnchor : undefined;
    const segEndAnchor = i === points.length - 2 ? endAnchor : undefined;
    const res = computeObstacleAwarePath(points[i], points[i + 1], segStartAnchor, segEndAnchor, filletRadius);
    if (i === 0) {
      pathD += res.pathD;
      waypoints.push(...res.waypoints);
    } else {
      pathD += res.pathD.replace(/^M\s+[\d.-]+\s+[\d.-]+/, "");
      waypoints.push(...res.waypoints.slice(1));
    }
  }
  return { pathD, waypoints };
}

// Catmull-Rom through all points converted to cubic Beziers — smooth, non-self-intersecting
// for reasonable waypoint layouts, degrades to a single "C" for the classic 2-point case.
function computeCatmullRomPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${Math.round(cp1x)} ${Math.round(cp1y)}, ${Math.round(cp2x)} ${Math.round(cp2y)}, ${Math.round(p2.x)} ${Math.round(p2.y)}`;
  }
  return d;
}

function findBestLabelPosition(
  waypoints: { x: number; y: number }[],
  obstacles: { x: number; y: number; width: number; height: number }[]
): { x: number; y: number } {
  let longestLen = -1;
  let bestMid = {
    x: Math.round((waypoints[0].x + waypoints[waypoints.length - 1].x) / 2),
    y: Math.round((waypoints[0].y + waypoints[waypoints.length - 1].y) / 2),
  };

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const mid = { x: Math.round((p1.x + p2.x) / 2), y: Math.round((p1.y + p2.y) / 2) };

    const collides = obstacles.some(
      (b) => mid.x >= b.x - 12 && mid.x <= b.x + b.width + 12 && mid.y >= b.y - 12 && mid.y <= b.y + b.height + 12
    );

    if (!collides && segLen > longestLen) {
      longestLen = segLen;
      bestMid = mid;
    }
  }

  return bestMid;
}

// ─── Squarified Treemap Layout (Bruls, Huizing, van Wijk) ───────────────────
type TreemapRect = { x: number; y: number; w: number; h: number };

function worstAspect(rowAreas: number[], side: number, sum: number): number {
  const maxA = Math.max(...rowAreas);
  const minA = Math.min(...rowAreas);
  const sideSq = side * side;
  const sumSq = sum * sum;
  return Math.max((sideSq * maxA) / sumSq, sumSq / (sideSq * minA));
}

function squarifyTreemap(items: { value: number }[], rect: TreemapRect): TreemapRect[] {
  const order = items.map((_, i) => i).sort((a, b) => items[b].value - items[a].value);
  const total = items.reduce((sum, it) => sum + it.value, 0) || 1;
  const scale = (rect.w * rect.h) / total;
  const areas = order.map((i) => Math.max(0.01, items[i].value * scale));

  const placed: TreemapRect[] = new Array(items.length);
  let queue = areas.map((area, i) => ({ area, orderIdx: i }));
  let { x, y, w, h } = rect;

  while (queue.length > 0) {
    const side = Math.min(w, h);
    let row = [queue[0]];
    let rowSum = row[0].area;
    let bestWorst = worstAspect([row[0].area], side, rowSum);
    let k = 1;
    while (k < queue.length) {
      const testSum = rowSum + queue[k].area;
      const testWorst = worstAspect([...row.map((r) => r.area), queue[k].area], side, testSum);
      if (testWorst <= bestWorst) {
        row.push(queue[k]);
        rowSum = testSum;
        bestWorst = testWorst;
        k++;
      } else break;
    }

    const thickness = side > 0 ? rowSum / side : 0;
    if (w <= h) {
      let cx = x;
      for (const cell of row) {
        const cw = thickness > 0 ? cell.area / thickness : 0;
        placed[order[cell.orderIdx]] = { x: cx, y, w: cw, h: thickness };
        cx += cw;
      }
      y += thickness;
      h -= thickness;
    } else {
      let cy = y;
      for (const cell of row) {
        const ch = thickness > 0 ? cell.area / thickness : 0;
        placed[order[cell.orderIdx]] = { x, y: cy, w: thickness, h: ch };
        cy += ch;
      }
      x += thickness;
      w -= thickness;
    }
    queue = queue.slice(row.length);
  }

  return placed;
}

export function freeformToSvg(
  doc: CanvasDocument,
  options?: { theme?: "light" | "dark" | "cyber" | "editorial"; bare?: boolean }
): string {
  if (doc.shapes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 400 300"><text x="200" y="150" text-anchor="middle" fill="#94a3b8" font-family="Inter, sans-serif" font-size="14">Empty Canvas</text></svg>`;
  }

  const isDark = options?.theme === "dark" || options?.theme === "cyber";
  const isEditorial = options?.theme === "editorial";

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const obstacleBounds: { x: number; y: number; width: number; height: number }[] = [];

  for (const shape of doc.shapes) {
    const b = getShapeBounds(doc, shape);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);

    if (shape.type !== "arrow" && shape.type !== "line" && shape.type !== "frame" && shape.type !== "mockup" && shape.type !== "dashboard") {
      obstacleBounds.push(b);
    }
  }

  const padding = options?.bare ? 0 : 60;
  const vx = Math.round(minX - padding);
  const vy = Math.round(minY - padding);
  const vw = options?.bare
    ? Math.max(1, Math.round(maxX - minX))
    : Math.max(100, Math.round(maxX - minX + padding * 2));
  const vh = options?.bare
    ? Math.max(1, Math.round(maxY - minY))
    : Math.max(100, Math.round(maxY - minY + padding * 2));

  // McKinsey & Executive Consulting Palette System
  const canvasBg = isDark ? "#0b0f19" : isEditorial ? "#f5f2eb" : "#f8fafc";
  const dotColor = isDark ? "#1e293b" : isEditorial ? "#e2ded4" : "#cbd5e1";
  const textColorPrimary = isDark ? "#f8fafc" : "#0f172a";
  const textColorMuted = isDark ? "#94a3b8" : "#475569";
  const cardBg = isDark ? "#111827" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0";
  const gridLineColor = isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0";

  const defs = `
  <defs>
    <filter id="soft-card-shadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="${isDark ? "0.45" : "0.06"}" />
      <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="#000000" flood-opacity="${isDark ? "0.2" : "0.03"}" />
    </filter>
    <filter id="pill-shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="${isDark ? "0.3" : "0.05"}" />
    </filter>
    <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4A85F6" stop-opacity="${isDark ? "0.45" : "0.25"}"/>
      <stop offset="100%" stop-color="#4A85F6" stop-opacity="0.0"/>
    </linearGradient>
    <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#10b981" stop-opacity="${isDark ? "0.35" : "0.2"}"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
    </linearGradient>
    <pattern id="estimate-stripes" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#d97706" stroke-width="2.5" />
    </pattern>
    <marker id="arrowhead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="${isDark ? "#94a3b8" : "#475569"}" />
    </marker>
    <marker id="arrowhead-start" viewBox="0 0 10 10" refX="1.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 8.5 1.5 L 0 5 L 8.5 8.5 z" fill="${isDark ? "#94a3b8" : "#475569"}" />
    </marker>
  </defs>`;

  const elements: string[] = [];

  // Array order is the documented z-order contract — a container must not jump
  // in front of unrelated shapes just because it's a container (that broke plain
  // background rects authored before a frame). Only pull a container ahead of
  // its OWN children when those children were authored before it in the array.
  const earliestChildIndex = new Map<string, number>();
  doc.shapes.forEach((s, i) => {
    if (s.frameId && (earliestChildIndex.get(s.frameId) ?? Infinity) > i) {
      earliestChildIndex.set(s.frameId, i);
    }
  });
  const sortedShapes = doc.shapes
    .map((shape, i) => {
      const isContainer = shape.type === "dashboard" || shape.type === "frame" || shape.type === "mockup";
      const earliestChild = isContainer ? earliestChildIndex.get(shape.id) : undefined;
      const key = earliestChild !== undefined && earliestChild < i ? earliestChild - 0.5 : i;
      return { shape, key };
    })
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.shape);

  for (const shape of sortedShapes) {
    const bounds = getShapeBounds(doc, shape);
    const w = bounds.width;
    const h = bounds.height;
    const x = bounds.x;
    const y = bounds.y;

    const rawFill = shape.fill ? resolveColor(shape.fill) ?? shape.fill : shape.type === "sticky" ? "#fef08a" : cardBg;
    const fill = rawFill === "transparent" ? "none" : rawFill;
    const stroke = shape.stroke ? resolveColor(shape.stroke) ?? shape.stroke : shape.type === "frame" ? (isDark ? "#334155" : "#cbd5e1") : cardBorder;
    const strokeWidth = shape.strokeWidth ?? 1.5;
    const opacity = shape.opacity !== undefined ? `opacity="${shape.opacity}"` : "";
    const strokeDash =
      shape.strokeDash === "dashed"
        ? 'stroke-dasharray="8,6"'
        : shape.strokeDash === "dotted"
          ? 'stroke-dasharray="3,4"'
          : "";

    const shadowFilter =
      shape.shadow === false
        ? ""
        : shape.type === "sticky"
          ? 'filter="url(#soft-card-shadow)"'
          : shape.type !== "frame" && shape.type !== "dashboard"
            ? 'filter="url(#soft-card-shadow)"'
            : "";

    // ─── Freehand Path ────────────────────────────────────────────────────────
    if (shape.type === "path") {
      const pathShape = shape as PathShape;
      const strokePoints = getStroke(pathShape.points, {
        size: (pathShape.strokeWidth ?? 2) * 3,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      });
      const svgPath = getSvgPathFromStroke(strokePoints);
      elements.push(`<path d="${svgPath}" fill="${stroke}" ${opacity} />`);
      continue;
    }

    // ─── Connectors (Arrows & Lines) with Obstacle Clearance ──────────────────
    if (shape.type === "arrow" || shape.type === "line") {
      const arrow = shape as ArrowShape;
      const { start, end } = resolveArrowRenderEndpoints(doc, arrow);
      const headStart = resolveArrowHeadStyle(arrow, "start");
      const headEnd = resolveArrowHeadStyle(arrow, "end");
      const markerEnd = headEnd === "arrow" ? 'marker-end="url(#arrowhead)"' : "";
      const markerStart = headStart === "arrow" ? 'marker-start="url(#arrowhead-start)"' : "";

      const startAnchor = isBoundEndpoint(arrow.start) ? arrow.start.anchor : undefined;
      const endAnchor = isBoundEndpoint(arrow.end) ? arrow.end.anchor : undefined;
      const fullPoints = [start, ...(arrow.waypoints ?? []), end];

      const buildRoute = (pts: { x: number; y: number }[]): { pathD: string; waypoints: { x: number; y: number }[] } => {
        if (arrow.routing === "orthogonal") {
          const res = computeObstacleAwarePathMulti(pts, startAnchor, endAnchor, 8);
          return { pathD: res.pathD, waypoints: res.waypoints };
        }
        if (arrow.routing === "curved") return { pathD: computeCatmullRomPathD(pts), waypoints: pts };
        return { pathD: pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" "), waypoints: pts };
      };

      // Route once to learn the real last-segment direction (orthogonal bends it),
      // then re-route against the trimmed endpoints so an open head isn't skewered.
      const probe = buildRoute(fullPoints).waypoints;
      const startGeom = computeArrowHeadGeometry(probe[0], probe[1] ?? probe[0], headStart, strokeWidth);
      const endGeom = computeArrowHeadGeometry(
        probe[probe.length - 1],
        probe[probe.length - 2] ?? probe[probe.length - 1],
        headEnd,
        strokeWidth
      );

      const routePoints = [...fullPoints];
      if (startGeom) routePoints[0] = startGeom.lineEnd;
      if (endGeom) routePoints[routePoints.length - 1] = endGeom.lineEnd;
      const { pathD, waypoints } = buildRoute(routePoints);

      elements.push(
        `<path d="${pathD}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${strokeDash} fill="none" ${markerStart} ${markerEnd} ${opacity} />`
      );

      for (const geom of [startGeom, endGeom]) {
        if (!geom) continue;
        elements.push(
          `<polygon points="${geom.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${geom.filled ? stroke : cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" ${opacity} />`
        );
      }

      if (arrow.showJunctions) {
        for (const p of fullPoints) {
          elements.push(
            `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${cardBg}" stroke="${stroke}" stroke-width="1.5" ${opacity} />`
          );
        }
      }

      if (arrow.label) {
        const bestPos = findBestLabelPosition(waypoints, obstacleBounds);
        const labelWidth = Math.max(52, arrow.label.length * 7.5 + 18);

        // Offset perpendicular-above the segment direction at the label point so the
        // pill doesn't sit directly on the line and collide with shape/frame labels.
        let segA = waypoints[0];
        let segB = waypoints[waypoints.length - 1];
        for (let i = 0; i < waypoints.length - 1; i++) {
          const midX = Math.round((waypoints[i].x + waypoints[i + 1].x) / 2);
          const midY = Math.round((waypoints[i].y + waypoints[i + 1].y) / 2);
          if (midX === bestPos.x && midY === bestPos.y) {
            segA = waypoints[i];
            segB = waypoints[i + 1];
            break;
          }
        }
        const segDx = segB.x - segA.x;
        const segDy = segB.y - segA.y;
        const segLen = Math.hypot(segDx, segDy) || 1;
        const normX = -segDy / segLen;
        const normY = segDx / segLen;
        const labelX = bestPos.x + normX * 14;
        const labelY = bestPos.y + normY * 14;

        const plain = arrow.labelStyle === "plain";
        const labelBg = plain
          ? `<rect x="-${labelWidth / 2}" y="-9" width="${labelWidth}" height="18" fill="${cardBg}" />`
          : `<rect x="-${labelWidth / 2}" y="-11" width="${labelWidth}" height="22" rx="6" fill="${cardBg}" stroke="${cardBorder}" stroke-width="1.2" filter="url(#pill-shadow)" />`;

        elements.push(
          `<g transform="translate(${labelX}, ${labelY})">
            ${labelBg}
            <text x="0" y="4" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="${plain ? 12 : 11}" font-weight="${plain ? "500" : "600"}" fill="${plain ? textColorPrimary : textColorMuted}">${escapeXml(arrow.label)}</text>
          </g>`
        );
      }
      continue;
    }

    // ─── 1. Executive Dashboard Frame (`type: "dashboard"`) ─────────────────
    if (shape.type === "dashboard") {
      const d = shape as DashboardShape;
      const tabs = d.tabs ?? [{ label: "Home" }, { label: "Exec Summary", active: true }, { label: "Revenue" }, { label: "Profitability" }, { label: "Balance Sheet" }];
      const actions = d.actions ?? [{ label: "Filters", icon: "filter" }, { label: "Download CSV" }, { label: "Ask AI" }, { label: "Dark" }];
      const banner = d.highlightBanner;

      const bannerBg = banner?.variant === "emerald"
        ? (isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5")
        : banner?.variant === "blue"
          ? (isDark ? "rgba(2,132,199,0.15)" : "#f0f9ff")
          : (isDark ? "rgba(244,63,94,0.15)" : "#fff1f2");
      const bannerBorder = banner?.variant === "emerald"
        ? (isDark ? "#10b981" : "#a7f3d0")
        : banner?.variant === "blue"
          ? (isDark ? "#0284c7" : "#bae6fd")
          : (isDark ? "#f43f5e" : "#fda4af");
      const bannerBar = banner?.variant === "emerald" ? "#059669" : banner?.variant === "blue" ? "#0284c7" : "#e11d48";
      const bannerText = banner?.variant === "emerald"
        ? (isDark ? "#6ee7b7" : "#047857")
        : banner?.variant === "blue"
          ? (isDark ? "#7dd3fc" : "#0369a1")
          : (isDark ? "#fda4af" : "#be123c");

      elements.push(
        `<g ${opacity}>
          <!-- Dashboard Top Navigation Bar -->
          <rect x="${x}" y="${y}" width="${w}" height="44" fill="${isDark ? "#111827" : "#ffffff"}" stroke="${cardBorder}" stroke-width="1" rx="8" />
          <text x="${x + 16}" y="${y + 27}" font-family="Inter, -apple-system, sans-serif" font-size="14" font-weight="800" fill="${textColorPrimary}">${escapeXml(d.title)}</text>
          <!-- Navigation Tabs -->
          <g transform="translate(${x + 160}, ${y + 8})">
            ${tabs.map((t, idx) => {
              const tabX = idx * 96;
              return t.active
                ? `<rect x="${tabX}" y="0" width="92" height="28" rx="14" fill="${isDark ? "#334155" : "#0f172a"}"/><text x="${tabX + 46}" y="18" text-anchor="middle" font-family="Inter, sans-serif" font-size="11.5" font-weight="700" fill="#ffffff">${escapeXml(t.label)}</text>`
                : `<text x="${tabX + 46}" y="18" text-anchor="middle" font-family="Inter, sans-serif" font-size="11.5" font-weight="500" fill="${textColorMuted}">${escapeXml(t.label)}</text>`;
            }).join("")}
          </g>
          <!-- Top Right Action Buttons -->
          <g transform="translate(${x + w - 320}, ${y + 8})">
            ${actions.map((act, idx) => {
              const actX = idx * 76;
              return `<rect x="${actX}" y="0" width="70" height="28" rx="14" fill="${isDark ? "#1e293b" : "#f1f5f9"}" stroke="${cardBorder}" stroke-width="1"/><text x="${actX + 35}" y="18" text-anchor="middle" font-family="Inter, sans-serif" font-size="10.5" font-weight="600" fill="${textColorPrimary}">${escapeXml(act.label)}</text>`;
            }).join("")}
          </g>
          <!-- Financial Subheader -->
          ${d.subtitle ? `
          <text x="${x + 16}" y="${y + 78}" font-family="Inter, -apple-system, sans-serif" font-size="18" font-weight="800" fill="${textColorPrimary}">${escapeXml(d.subtitle)}</text>` : ""}
          <!-- Highlight Banner Callout -->
          ${banner ? `
          <g transform="translate(${x + 16}, ${y + 92})">
            <rect x="0" y="0" width="${w - 32}" height="32" rx="6" fill="${bannerBg}" stroke="${bannerBorder}" stroke-width="1" />
            <line x1="0" y1="0" x2="0" y2="32" stroke="${bannerBar}" stroke-width="4" />
            <text x="14" y="20" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="${bannerText}">${escapeXml(banner.text)}</text>
          </g>` : ""}
        </g>`
      );
      continue;
    }

    // ─── 2. Device / Browser / Mobile Mockup (`type: "mockup"`) ──────────────
    if (shape.type === "mockup") {
      const m = shape as MockupShape;
      const rx = m.cornerRadius ?? (m.mockupType === "mobile" ? 36 : 14);

      if (m.mockupType === "mobile") {
        elements.push(
          `<g ${shadowFilter} ${opacity}>
            <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${cardBg}" stroke="${stroke}" stroke-width="3" />
            <rect x="${x + w / 2 - 45}" y="${y + 12}" width="90" height="22" rx="11" fill="#000000" />
            <rect x="${x + w / 2 - 50}" y="${y + h - 14}" width="100" height="4" rx="2" fill="${isDark ? "#475569" : "#cbd5e1"}" />
          </g>`
        );
      } else {
        const urlText = m.url ?? "https://app.drawstack.io/analytics";
        elements.push(
          `<g ${shadowFilter} ${opacity}>
            <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <rect x="${x}" y="${y}" width="${w}" height="38" rx="${rx}" fill="${isDark ? "#1e293b" : "#f1f5f9"}" />
            <rect x="${x}" y="${y + 26}" width="${w}" height="12" fill="${isDark ? "#1e293b" : "#f1f5f9"}" />
            <line x1="${x}" y1="${y + 38}" x2="${x + w}" y2="${y + 38}" stroke="${isDark ? "#334155" : "#e2e8f0"}" stroke-width="1" />
            <circle cx="${x + 18}" cy="${y + 19}" r="5" fill="#ff5f56" />
            <circle cx="${x + 34}" cy="${y + 19}" r="5" fill="#ffbd2e" />
            <circle cx="${x + 50}" cy="${y + 19}" r="5" fill="#27c93f" />
            <rect x="${x + 72}" y="${y + 8}" width="${Math.min(w - 144, 280)}" height="22" rx="6" fill="${cardBg}" stroke="${cardBorder}" stroke-width="1" />
            <text x="${x + 82}" y="${y + 23}" font-family="'JetBrains Mono', Inter, monospace" font-size="10" font-weight="500" fill="${textColorMuted}">${escapeXml(urlText)}</text>
          </g>`
        );
      }
      continue;
    }

    // ─── 3. Metric / KPI Stat Card (`type: "metric"`) ────────────────────────
    if (shape.type === "metric") {
      const m = shape as MetricShape;
      const deltaColor = m.deltaDirection === "down" ? "#dc2626" : "#059669";
      const deltaBg = isDark ? (m.deltaDirection === "down" ? "rgba(220,38,38,0.2)" : "rgba(5,150,105,0.2)") : m.deltaDirection === "down" ? "#fee2e2" : "#d1fae5";
      const iconName = m.icon ?? "activity";

      // Grounded Spline Sparkline (McKinsey Standard)
      const pts = m.sparkline ?? [10, 25, 18, 30, 24, 42, 38, 55];
      const sparkW = 86;
      const sparkH = 34;
      const minV = Math.min(...pts);
      const maxV = Math.max(...pts);
      const range = maxV - minV || 1;
      const sparkX0 = x + w - sparkW - 14;
      const sparkY0 = y + h - sparkH - 14;

      const coords = pts.map((val, idx) => ({
        x: sparkX0 + (idx / (pts.length - 1)) * sparkW,
        y: sparkY0 + sparkH - ((val - minV) / range) * sparkH,
      }));

      let sparkPath = `M ${coords[0].x} ${coords[0].y}`;
      for (let i = 1; i < coords.length; i++) {
        const cx = (coords[i - 1].x + coords[i].x) / 2;
        sparkPath += ` C ${cx} ${coords[i - 1].y}, ${cx} ${coords[i].y}, ${coords[i].x} ${coords[i].y}`;
      }
      const sparkArea = `${sparkPath} L ${coords[coords.length - 1].x} ${sparkY0 + sparkH} L ${coords[0].x} ${sparkY0 + sparkH} Z`;

      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${m.cornerRadius ?? 10}" fill="${cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <g transform="translate(${x + 14}, ${y + 14}) scale(0.66)">
            ${getSvgIcon(iconName, 16, isDark ? "#60a5fa" : "#4A85F6")}
          </g>
          <text x="${x + 36}" y="${y + 24}" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="700" fill="${textColorMuted}">${escapeXml(m.label.toUpperCase())}</text>
          <text x="${x + 14}" y="${y + 62}" font-family="Inter, -apple-system, sans-serif" font-size="24" font-weight="800" fill="${textColorPrimary}">${escapeXml(m.value)}</text>
          ${m.delta ? `
          <g transform="translate(${x + 14}, ${y + 78})">
            <rect x="0" y="0" width="${m.delta.length * 6.5 + 14}" height="18" rx="4" fill="${deltaBg}" />
            <text x="${(m.delta.length * 6.5 + 14) / 2}" y="12.5" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="10" font-weight="700" fill="${deltaColor}">${escapeXml(m.delta)}</text>
          </g>` : ""}
          <!-- Grounded Sparkline with Baseline & Gradient -->
          <line x1="${sparkX0}" y1="${sparkY0 + sparkH}" x2="${sparkX0 + sparkW}" y2="${sparkY0 + sparkH}" stroke="${gridLineColor}" stroke-width="1" />
          <path d="${sparkArea}" fill="url(#sparkline-grad)" />
          <path d="${sparkPath}" fill="none" stroke="${deltaColor}" stroke-width="2" stroke-linecap="round" />
          <circle cx="${coords[coords.length - 1].x}" cy="${coords[coords.length - 1].y}" r="3" fill="${cardBg}" stroke="${deltaColor}" stroke-width="1.5" />
        </g>`
      );
      continue;
    }

    // ─── 4. Multi-Modal Visual Chart (`type: "chart"`) ───────────────────────
    if (shape.type === "chart") {
      const c = shape as ChartShape;
      const chartType = c.chartType ?? "area";
      const padLeft = 48;
      const padRight = 24;
      const padTop = 64;
      const padBottom = 38;
      const innerW = w - padLeft - padRight;
      const innerH = h - padTop - padBottom;

      let chartBody = "";

      // A. Grouped Bar Chart (McKinsey Gridlines & Legend Standard)
      if (chartType === "grouped_bar" && c.groupedData) {
        let maxVal = 1;
        const seriesNames = new Set<string>();
        const seriesColors: Record<string, string> = {};

        for (const cat of c.groupedData) {
          for (const s of cat.series) {
            if (s.value > maxVal) maxVal = s.value;
            seriesNames.add(s.name);
            if (s.color) seriesColors[s.name] = s.color;
          }
        }

        // Compute 4 grid intervals
        const niceCeil = Math.ceil(maxVal * 1.15);
        const gridLinesSvg = [0, 0.25, 0.5, 0.75, 1.0].map((pct) => {
          const gy = y + padTop + innerH * (1 - pct);
          const tickVal = (niceCeil * pct).toFixed(pct === 0 ? 0 : 1);
          return `
            <g>
              <line x1="${x + padLeft}" y1="${gy}" x2="${x + w - padRight}" y2="${gy}" stroke="${pct === 0 ? (isDark ? "#475569" : "#94a3b8") : gridLineColor}" stroke-width="${pct === 0 ? 1.5 : 1}" stroke-dasharray="${pct === 0 ? "none" : "3,3"}" />
              <text x="${x + padLeft - 8}" y="${gy + 3.5}" text-anchor="end" font-family="'JetBrains Mono', Inter, monospace" font-size="9" font-weight="500" fill="${textColorMuted}">$${tickVal}M</text>
            </g>`;
        }).join("");

        // Top Series Legend
        const seriesArray = Array.from(seriesNames);
        const legendSvg = seriesArray.map((name, idx) => {
          const lx = x + w - padRight - (seriesArray.length - idx) * 85;
          const sColor = seriesColors[name] ?? (idx === 0 ? "#4A85F6" : "#94a3b8");
          return `
            <g transform="translate(${lx}, ${y + 22})">
              <rect x="0" y="0" width="8" height="8" rx="2" fill="${sColor}" />
              <text x="12" y="8" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="${textColorMuted}">${escapeXml(name)}</text>
            </g>`;
        }).join("");

        const numCats = c.groupedData.length;
        const catWidth = innerW / numCats;

        const barsSvg = c.groupedData.map((cat, catIdx) => {
          const groupX = x + padLeft + catIdx * catWidth;
          const numSeries = cat.series.length;
          const barW = Math.min(28, (catWidth * 0.65) / numSeries);
          const groupOffset = (catWidth - numSeries * barW - (numSeries - 1) * 4) / 2;

          const bars = cat.series.map((s, sIdx) => {
            const barH = (s.value / niceCeil) * innerH;
            const bx = groupX + groupOffset + sIdx * (barW + 4);
            const by = y + padTop + innerH - barH;
            const barColor = s.color ?? (sIdx === 0 ? "#4A85F6" : "#94a3b8");
            const fillStyle = s.isEstimate ? `fill="url(#estimate-stripes)" stroke="#d97706" stroke-dasharray="4,3"` : `fill="${barColor}"`;

            return `
              <g>
                <rect x="${bx}" y="${by}" width="${barW}" height="${barH}" rx="3" ${fillStyle} stroke-width="1.2" />
                <text x="${bx + barW / 2}" y="${by - 6}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="${textColorPrimary}">${s.formatted ?? "$" + s.value + "M"}</text>
              </g>`;
          }).join("");

          return `
            <g>
              ${bars}
              <text x="${groupX + catWidth / 2}" y="${y + padTop + innerH + 20}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10.5" font-weight="600" fill="${textColorMuted}">${escapeXml(cat.category)}</text>
            </g>`;
        }).join("");

        // X and Y Axes
        const axesSvg = `
          <g>
            <line x1="${x + padLeft}" y1="${y + padTop}" x2="${x + padLeft}" y2="${y + padTop + innerH}" stroke="${gridLineColor}" stroke-width="1.5" />
            <line x1="${x + padLeft}" y1="${y + padTop + innerH}" x2="${x + w - padRight}" y2="${y + padTop + innerH}" stroke="${isDark ? "#475569" : "#94a3b8"}" stroke-width="1.5" />
          </g>
        `;

        chartBody = `${gridLinesSvg}${axesSvg}${legendSvg}${barsSvg}`;
      }

      // B. Donut Mix Chart (Centered Pie, Left Legend)
      else if (chartType === "donut" && c.donutData) {
        // Legend occupies a fixed left column; the donut gets whatever is left, so the
        // arc can never grow into the legend text on a narrow card.
        const legendW = Math.min(140, innerW * 0.45);
        const donutSpace = innerW - legendW;
        const strokeW = 32;
        const radius = Math.max(28, Math.min(donutSpace / 2 - strokeW / 2, innerH * 0.42, 75));
        const cx = x + padLeft + legendW + donutSpace / 2;
        const cy = y + padTop + innerH / 2 - 10;
        const circumference = 2 * Math.PI * radius;

        let accumulatedPercent = 0;
        const donutArcs = c.donutData.map((slice) => {
          const strokeDash = (slice.percent / 100) * circumference - 2.5;
          const strokeOffset = -(accumulatedPercent / 100) * circumference;
          accumulatedPercent += slice.percent;

          return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${slice.color}" stroke-width="${strokeW}" stroke-dasharray="${Math.max(0, strokeDash)} ${circumference}" stroke-dashoffset="${strokeOffset}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt" />`;
        }).join("");

        // Move legend to the left
        const startLegendY = y + padTop;
        const legendItems = c.donutData.map((slice, idx) => {
          const ly = startLegendY + idx * 34;
          const lx = x + padLeft;
          return `
            <g transform="translate(${lx}, ${ly})">
              <rect x="0" y="0" width="12" height="12" rx="3" fill="${slice.color}" />
              <text x="22" y="10" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="${textColorPrimary}">${escapeXml(slice.label)}</text>
              <text x="22" y="26" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" fill="${textColorMuted}">${escapeXml(slice.value)} · ${slice.percent}%</text>
            </g>`;
        }).join("");

        // centerLabel is the text in the donut hole — primary over secondary.
        const hasSecondary = Boolean(c.centerLabel?.secondary);
        const primaryY = hasSecondary ? cy + 1 : cy + 6;

        chartBody = `
          ${donutArcs}
          <text x="${cx}" y="${primaryY}" text-anchor="middle" font-family="Inter, sans-serif" font-size="18" font-weight="800" fill="${textColorPrimary}">${escapeXml(c.centerLabel?.primary ?? "")}</text>
          ${hasSecondary ? `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="600" letter-spacing="0.06em" fill="${textColorMuted}">${escapeXml(c.centerLabel!.secondary!)}</text>` : ""}
          ${legendItems}
        `;
      }

      // C. Horizontal Ranking Bar Chart
      else if (chartType === "horizontal_bar" && c.data) {
        const rowH = innerH / c.data.length;
        const maxVal = Math.max(...c.data.map(d => d.value), 1);

        // Reserve gutters for the label and the value so neither can overflow the card.
        const labelGutter = Math.min(120, innerW * 0.36);
        const valueGutter = 44;
        const barTrack = Math.max(20, innerW - labelGutter - valueGutter);

        chartBody = c.data.map((d, idx) => {
          const ry = y + padTop + idx * rowH;
          const barWidth = Math.max(4, (d.value / maxVal) * barTrack);
          const barColor = d.color ?? "#4A85F6";

          return `
            <g transform="translate(${x + padLeft}, ${ry})">
              <text x="0" y="14" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${textColorMuted}">${escapeXml(d.label)}</text>
              <rect x="${labelGutter}" y="2" width="${barWidth}" height="16" rx="4" fill="${barColor}" />
              <text x="${labelGutter + barWidth + 8}" y="14" font-family="Inter, sans-serif" font-size="10.5" font-weight="700" fill="${textColorPrimary}">${d.value}%</text>
            </g>`;
        }).join("");
      }

      // D. Multi-Segment Progress Gauge
      else if (chartType === "progress_gauge" && c.progressSegments) {
        chartBody = c.progressSegments.map((seg, idx) => {
          const sy = y + padTop + 10 + idx * 42;
          return `
            <g transform="translate(${x + padLeft}, ${sy})">
              <text x="0" y="0" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${textColorMuted}">${escapeXml(seg.label)}</text>
              <text x="${innerW}" y="0" text-anchor="end" font-family="Inter, sans-serif" font-size="11.5" font-weight="800" fill="${textColorPrimary}">${escapeXml(seg.value)}</text>
              <rect x="0" y="8" width="${innerW}" height="7" rx="3.5" fill="${isDark ? "#1e293b" : "#e2e8f0"}" />
              <rect x="0" y="8" width="${(seg.percent / 100) * innerW}" height="7" rx="3.5" fill="${seg.color}" />
            </g>`;
        }).join("");
      }

      // F. Squarified Treemap — proportional-area blocks (market share, locations by region).
      else if (chartType === "treemap" && c.treemapData && c.treemapData.length > 0) {
        const treemapPalette = ["#f6e7d7", "#8fc7e8", "#f29b95", "#8fd8a8", "#d9c49a", "#b8b3e8"];
        const cells = squarifyTreemap(c.treemapData, { x: x + padLeft, y: y + padTop, w: innerW, h: innerH });

        const cellsSvg = cells.map((cell, idx) => {
          const item = c.treemapData![idx];
          const cx = cell.x + 1;
          const cy = cell.y + 1;
          const cw = Math.max(0, cell.w - 2);
          const ch = Math.max(0, cell.h - 2);
          const cellFill = item.color ?? treemapPalette[idx % treemapPalette.length];
          const area = cw * ch;
          const cellText = textColorForFill(cellFill);

          let labelSvg = "";
          if (area > 5500) {
            const labelFits = item.label.length * 0.6 * 13 <= cw - 16;
            const valueStr = String(item.value);
            if (labelFits) {
              labelSvg = `
                <text x="${cx + 8}" y="${cy + 22}" font-family="Inter, sans-serif" font-size="13" font-weight="700" fill="${cellText}">${escapeXml(item.label)}</text>
                <text x="${cx + 8}" y="${cy + 46}" font-family="Inter, sans-serif" font-size="20" font-weight="800" fill="${cellText}">${escapeXml(valueStr)}</text>
                ${item.sublabel ? `<text x="${cx + 8}" y="${cy + 62}" font-family="Inter, sans-serif" font-size="9.5" font-weight="500" fill="${cellText}" opacity="0.75">${escapeXml(item.sublabel)}</text>` : ""}`;
            }
          } else if (area >= 1800) {
            const labelFits = item.label.length * 0.6 * 9.5 <= cw - 12;
            if (labelFits) {
              labelSvg = `
                <text x="${cx + 6}" y="${cy + 16}" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="${cellText}">${escapeXml(item.label)}</text>
                <text x="${cx + 6}" y="${cy + 30}" font-family="Inter, sans-serif" font-size="12" font-weight="800" fill="${cellText}">${escapeXml(String(item.value))}</text>`;
            }
          }

          return `
            <g>
              <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${cellFill}" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
              ${labelSvg}
            </g>`;
        }).join("");

        const legendSvg = c.treemapLegend
          ? `<g transform="translate(${x + w - 140 - 16}, ${y + 16})">
              ${c.treemapLegend.map((entry, idx) => `
                <g transform="translate(0, ${idx * 18})">
                  <rect x="0" y="0" width="10" height="10" rx="2" fill="${entry.color}" />
                  <text x="16" y="9" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${textColorMuted}">${escapeXml(entry.label)}</text>
                </g>`).join("")}
            </g>`
          : "";

        chartBody = `${cellsSvg}${legendSvg}`;
      }

      // E. Spline Area / Line / Bar with Y-Axis Gridlines.
      // Accepts either `data` or `groupedData` — the AI prompt documents groupedData for
      // every chart type, so gating this on `data` alone silently rendered an empty panel.
      else if ((c.data && c.data.length > 0) || (c.groupedData && c.groupedData.length > 0)) {
        const chartData =
          c.data && c.data.length > 0
            ? c.data
            : (c.groupedData ?? []).map((cat) => ({
                label: cat.category,
                value: cat.series[0]?.value ?? 0,
                color: cat.series[0]?.color,
              }));
        const maxVal = Math.max(...chartData.map(v => v.value), 1);
        const niceCeil = Math.ceil(maxVal * 1.15);

        const gridLinesSvg = [0, 0.33, 0.66, 1.0].map((pct) => {
          const gy = y + padTop + innerH * (1 - pct);
          const tickVal = Math.round(niceCeil * pct);
          return `
            <g>
              <line x1="${x + padLeft}" y1="${gy}" x2="${x + w - padRight}" y2="${gy}" stroke="${pct === 0 ? (isDark ? "#475569" : "#94a3b8") : gridLineColor}" stroke-width="${pct === 0 ? 1.5 : 1}" stroke-dasharray="${pct === 0 ? "none" : "3,3"}" />
              <text x="${x + padLeft - 8}" y="${gy + 3.5}" text-anchor="end" font-family="'JetBrains Mono', Inter, monospace" font-size="9" font-weight="500" fill="${textColorMuted}">${tickVal}</text>
            </g>`;
        }).join("");

        const coords = chartData.map((d, i) => ({
          x: x + padLeft + (i / (chartData.length - 1 || 1)) * innerW,
          y: y + padTop + innerH - (d.value / niceCeil) * innerH,
        }));

        let linePath = `M ${coords[0].x} ${coords[0].y}`;
        for (let i = 1; i < coords.length; i++) {
          const cx = (coords[i - 1].x + coords[i].x) / 2;
          linePath += ` C ${cx} ${coords[i - 1].y}, ${cx} ${coords[i].y}, ${coords[i].x} ${coords[i].y}`;
        }

        const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${y + padTop + innerH} L ${coords[0].x} ${y + padTop + innerH} Z`;
        const accent = isDark ? "#60a5fa" : "#4A85F6";

        const xLabels = coords
          .map(
            (p, idx) =>
              `<text x="${p.x}" y="${y + padTop + innerH + 18}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9.5" font-weight="600" fill="${textColorMuted}">${escapeXml(chartData[idx].label)}</text>`
          )
          .join("");

        if (chartType === "bar") {
          const slot = innerW / chartData.length;
          const barW = Math.min(46, slot * 0.6);
          chartBody = `
          ${gridLinesSvg}
          ${chartData
            .map((d, i) => {
              const bh = (d.value / niceCeil) * innerH;
              const bx = x + padLeft + slot * i + (slot - barW) / 2;
              const by = y + padTop + innerH - bh;
              return `<rect x="${bx}" y="${by}" width="${barW}" height="${Math.max(0, bh)}" rx="4" fill="${d.color ?? accent}" />
                <text x="${bx + barW / 2}" y="${by - 7}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="${textColorPrimary}">${escapeXml(String(d.value))}</text>`;
            })
            .join("")}
          ${xLabels}
        `;
        } else {
          chartBody = `
          ${gridLinesSvg}
          ${chartType === "line" ? "" : `<path d="${areaPath}" fill="url(#chart-area-grad)" />`}
          <path d="${linePath}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" />
          ${coords
            .map(
              (p) =>
                `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${cardBg}" stroke="${accent}" stroke-width="2" />`
            )
            .join("")}
          ${xLabels}
        `;
        }
      }

      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${c.cornerRadius ?? 10}" fill="${cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <text x="${x + 16}" y="${y + 26}" font-family="Inter, -apple-system, sans-serif" font-size="12.5" font-weight="800" fill="${textColorPrimary}">${escapeXml(c.title)}</text>
          ${c.subtitle ? `<text x="${x + 16}" y="${y + 44}" font-family="Inter, sans-serif" font-size="10.5" font-weight="500" fill="${textColorMuted}">${escapeXml(c.subtitle)}</text>` : ""}
          ${chartBody}
        </g>`
      );
      continue;
    }

    // ─── 5. Chronological Event Feed Table (`type: "feed_table"`) ───────────
    if (shape.type === "feed_table") {
      const ft = shape as FeedTableShape;
      const rowH = 34;

      const rowsSvg = ft.rows.map((row, idx) => {
        const ry = y + 54 + idx * rowH;
        const amtColor = row.amountColor ?? (row.amount?.startsWith("-") || row.amount?.includes("FX") ? "#dc2626" : "#059669");
        return `
          <g transform="translate(${x + 14}, ${ry})">
            <text x="0" y="14" font-family="'JetBrains Mono', Inter, monospace" font-size="10" font-weight="500" fill="${textColorMuted}">${escapeXml(row.date)}</text>
            <text x="75" y="14" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${textColorPrimary}">${escapeXml(row.event)}</text>
            ${row.amount ? `
            <text x="${w - 36}" y="14" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="11.5" font-weight="800" fill="${amtColor}">${escapeXml(row.amount)}</text>` : ""}
          </g>
          <line x1="${x + 14}" y1="${ry + 24}" x2="${x + w - 14}" y2="${ry + 24}" stroke="${isDark ? "#1e293b" : "#f1f5f9"}" stroke-width="1"/>`;
      }).join("");

      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${ft.cornerRadius ?? 10}" fill="${cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <text x="${x + 16}" y="${y + 26}" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="800" fill="${textColorPrimary}">${escapeXml(ft.title.toUpperCase())}</text>
          ${ft.subtitle ? `<text x="${x + 16}" y="${y + 42}" font-family="Inter, sans-serif" font-size="10" font-weight="500" fill="${textColorMuted}">${escapeXml(ft.subtitle)}</text>` : ""}
          ${rowsSvg}
        </g>`
      );
      continue;
    }

    // ─── 6. Swiss Editorial Concept Mindmap & Fishbone (`type: "mindmap"`) ───
    if (shape.type === "mindmap" || shape.type === "fishbone") {
      const mm = shape as MindmapShape;
      const stepLaneH = h / mm.steps.length;
      const spineX = x + w / 2;

      let mindmapSvg = "";

      mm.steps.forEach((step, idx) => {
        const laneY = y + idx * stepLaneH;
        const centerY = laneY + stepLaneH / 2;

        // Numbered Lane Baseline Guide
        mindmapSvg += `
          <text x="${x + 16}" y="${laneY + 28}" font-family="'JetBrains Mono', Inter, monospace" font-size="20" font-weight="400" fill="${isDark ? "#475569" : "#cbd5e1"}">${escapeXml(step.number)}</text>
          <line x1="${x + 50}" y1="${laneY + 24}" x2="${x + w - 20}" y2="${laneY + 24}" stroke="${isDark ? "#334155" : "#e2e8f0"}" stroke-dasharray="3,4" stroke-width="1"/>`;

        // Central Node / Spine Step
        if (step.isTerminal || idx === 0) {
          mindmapSvg += `
            <circle cx="${spineX}" cy="${centerY}" r="45" fill="${isDark ? "#ffffff" : "#000000"}" />
            <text x="${spineX}" y="${centerY - 4}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="700" fill="${isDark ? "#000000" : "#ffffff"}">${escapeXml(step.title)}</text>
            ${step.subtitle ? `<text x="${spineX}" y="${centerY + 12}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="500" fill="${isDark ? "#333333" : "#cccccc"}">${escapeXml(step.subtitle)}</text>` : ""}`;
        } else if (step.vennNodes) {
          const r = 40;
          const v1x = spineX;
          const v1y = centerY - 18;
          const v2x = spineX;
          const v2y = centerY + 22;

          mindmapSvg += `
            <circle cx="${v1x}" cy="${v1y}" r="${r}" fill="none" stroke="${textColorPrimary}" stroke-width="1.2" />
            <text x="${v1x}" y="${v1y - 4}" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${textColorPrimary}">${escapeXml(step.vennNodes[0]?.label ?? "")}</text>
            <circle cx="${v2x}" cy="${v2y}" r="${r}" fill="none" stroke="${textColorPrimary}" stroke-width="1.2" />
            <text x="${v2x}" y="${v2y + 8}" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${textColorPrimary}">${escapeXml(step.vennNodes[1]?.label ?? "")}</text>
            <path d="M ${v1x + r} ${v1y} L ${v1x + r + 24} ${v1y}" stroke="${textColorPrimary}" stroke-width="1" />
            <text x="${v1x + r + 30}" y="${v1y + 4}" font-family="Inter, sans-serif" font-size="10" font-weight="500" fill="${textColorMuted}">${escapeXml(step.vennNodes[0]?.callout ?? "")}</text>
            <path d="M ${v2x + r} ${v2y} L ${v2x + r + 24} ${v2y}" stroke="${textColorPrimary}" stroke-width="1" />
            <text x="${v2x + r + 30}" y="${v2y + 4}" font-family="Inter, sans-serif" font-size="10" font-weight="500" fill="${textColorMuted}">${escapeXml(step.vennNodes[1]?.callout ?? "")}</text>`;
        } else if (step.branches) {
          mindmapSvg += `<line x1="${spineX}" y1="${laneY + 10}" x2="${spineX}" y2="${laneY + stepLaneH - 10}" stroke="${textColorPrimary}" stroke-width="1.5" />`;
          step.branches.forEach((br, bIdx) => {
            const by = laneY + 24 + bIdx * 26;
            if (br.side === "left") {
              mindmapSvg += `
                <line x1="${spineX}" y1="${by}" x2="${spineX - 60}" y2="${by}" stroke="${textColorPrimary}" stroke-width="1" />
                <text x="${spineX - 68}" y="${by + 4}" text-anchor="end" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="${textColorPrimary}">${escapeXml(br.text)}</text>`;
            } else {
              mindmapSvg += `
                <line x1="${spineX}" y1="${by}" x2="${spineX + 60}" y2="${by}" stroke="${textColorPrimary}" stroke-width="1" />
                <text x="${spineX + 68}" y="${by + 4}" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="${textColorPrimary}">${escapeXml(br.text)}</text>`;
            }
          });
        } else if (step.pills) {
          step.pills.forEach((pill, pIdx) => {
            const py = laneY + 24 + pIdx * 32;
            mindmapSvg += `
              <line x1="${spineX}" y1="${py - 16}" x2="${spineX}" y2="${py - 6}" stroke="${textColorPrimary}" stroke-width="1" />
              <text x="${spineX}" y="${py + 6}" text-anchor="middle" font-family="Inter, sans-serif" font-size="11.5" font-weight="600" fill="${textColorPrimary}">/ ${escapeXml(pill)} /</text>`;
          });
        }
      });

      elements.push(
        `<g ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${mm.cornerRadius ?? 12}" fill="${cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          ${mindmapSvg}
        </g>`
      );
      continue;
    }

    // ─── 7. Editorial Serpentine S-Curve Timeline (`type: "scurve_timeline"`) ─
    if (shape.type === "scurve_timeline") {
      const sc = shape as SCurveTimelineShape;
      const numSteps = sc.steps.length;
      const trackColor = sc.strokeColor ?? "#034641";
      const hubColor = "#c2410c";

      const leftX = x + 85;
      const rightX = x + w - 85;
      const trackStartY = y + 170;
      const stepGapY = (h - 250) / Math.max(numSteps - 1, 1);

      // Fewer than 4 steps: the serpentine switchback tangles at this scale (hubs
      // overlap, lines cross). Lay hubs on a single gentle arc left-to-right instead.
      const isSmallN = numSteps <= 3;
      const hubPositions: { x: number; y: number }[] = isSmallN
        ? sc.steps.map((_, idx) => ({
            x: x + w * (0.12 + (0.76 * idx) / Math.max(1, numSteps - 1)),
            y: y + h * 0.55 + (idx % 2 ? -h * 0.06 : h * 0.06),
          }))
        : sc.steps.map((_, idx) => ({
            x: idx % 2 === 0 ? leftX : rightX,
            y: trackStartY + idx * stepGapY,
          }));

      let scurvePath = `M ${hubPositions[0].x} ${hubPositions[0].y}`;
      if (isSmallN) {
        for (let idx = 1; idx < hubPositions.length; idx++) {
          const prev = hubPositions[idx - 1];
          const curr = hubPositions[idx];
          const midX = (prev.x + curr.x) / 2;
          scurvePath += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
        }
      } else {
        sc.steps.forEach((_, idx) => {
          if (idx === 0) return;
          const prev = hubPositions[idx - 1];
          const curr = hubPositions[idx];
          const midY = (prev.y + curr.y) / 2;
          scurvePath += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
        });
      }

      const hubsSvg = sc.steps.map((st, idx) => {
        const isLeft = idx % 2 === 0;
        const hx = hubPositions[idx].x;
        const hy = hubPositions[idx].y;
        // Arc mode: the path runs through hub centers, so side text gets struck through.
        // Stack text above raised hubs / below lowered ones instead — always clear.
        const isRaised = idx % 2 === 1;
        const textX = isSmallN ? hx : isLeft ? hx + 55 : hx - 55;
        const align = isSmallN ? "middle" : isLeft ? "start" : "end";
        const titleY = isSmallN ? (isRaised ? hy - 64 : hy + 62) : hy - 12;
        const descY = isSmallN ? (isRaised ? hy - 46 : hy + 80) : hy + 10;

        const descLines = st.description.split("\n");
        const descTspans = descLines
          .map((line, lIdx) => `<tspan x="${textX}" dy="${lIdx === 0 ? 0 : 16}">${escapeXml(line)}</tspan>`)
          .join("");

        return `
          <g>
            <!-- Vermillion Step Circle -->
            <circle cx="${hx}" cy="${hy}" r="40" fill="${st.hubColor ?? hubColor}" />
            <!-- Step Number INSIDE Hub -->
            <text x="${hx}" y="${hy + 8}" text-anchor="middle" font-family="'JetBrains Mono', Inter, monospace" font-size="22" font-weight="900" fill="#ffffff">${escapeXml(st.stepNumber)}</text>
            <!-- Step Title & Description Alongside Hub -->
            <text x="${textX}" y="${titleY}" text-anchor="${align}" font-family="Inter, sans-serif" font-size="15" font-weight="800" fill="${textColorPrimary}">${escapeXml(st.title)}</text>
            <text x="${textX}" y="${descY}" text-anchor="${align}" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="${textColorMuted}">${descTspans}</text>
          </g>`;
      }).join("");

      // Add Walking Silhouette Figure on the central step
      const walkerSvg = sc.hasSilhouette !== false ? getSilhouetteFigure(x + w / 2 - 10, trackStartY + stepGapY * 1.5 - 38, 38) : "";

      elements.push(
        `<g ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${sc.cornerRadius ?? 14}" fill="${isEditorial ? "#f5f2eb" : cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <!-- Dedicated Header Banner at Top -->
          <text x="${x + 36}" y="${y + 38}" font-family="Inter, sans-serif" font-size="20" font-weight="800" fill="${textColorPrimary}">${escapeXml(sc.title)}</text>
          ${sc.subtitle ? `<text x="${x + 36}" y="${y + 64}" font-family="Inter, sans-serif" font-size="11" font-weight="700" letter-spacing="0.08em" fill="${textColorMuted}">${escapeXml(sc.subtitle.toUpperCase())}</text>` : ""}
          <line x1="${x + 36}" y1="${y + 80}" x2="${x + w - 36}" y2="${y + 80}" stroke="${isDark ? "#334155" : "#e2ded4"}" stroke-width="1" />
          <!-- Continuous Serpentine S-Curve Track -->
          <path d="${scurvePath}" fill="none" stroke="${trackColor}" stroke-width="5" stroke-linecap="round" />
          ${hubsSvg}
          ${walkerSvg}
        </g>`
      );
      continue;
    }

    // ─── 8. 3D Isometric Architectural Geometry (`type: "isometric_block"`) ──
    if (shape.type === "isometric_block") {
      const iso = shape as IsometricBlockShape;
      const cx = x + w / 2;
      const cy = y + h / 2 + 30;

      const isoSvg = `
        <g transform="translate(${cx}, ${cy})">
          <polygon points="-80,80 120,120 180,60 -20,20" fill="rgba(0,0,0,0.18)" />
          <polygon points="-120,0 0,60 0,100 -120,40" fill="#c2410c" />
          <polygon points="0,60 100,10 100,-30 0,20" fill="#7c2d12" />
          <polygon points="-120,0 0,-60 100,-10 -20,50" fill="#ea580c" />
          <polygon points="-40,-120 40,-80 40,20 -40,-20" fill="#c2410c" />
          <polygon points="40,-80 100,-110 100,-10 40,20" fill="#7c2d12" />
          <polygon points="-40,-120 20,-150 100,-110 40,-80" fill="#ea580c" />
          ${iso.hasSilhouette !== false ? getSilhouetteFigure(-70, -25, 34) : ""}
        </g>
      `;

      const calloutsSvg = iso.callouts.map((co, idx) => {
        const isLeft = co.side === "left" || idx === 0;
        const callX = isLeft ? x + 30 : x + w - 240;
        const callY = y + 100 + idx * 160;

        return `
          <g transform="translate(${callX}, ${callY})">
            <text x="0" y="0" font-family="Inter, sans-serif" font-size="16" font-weight="800" fill="${textColorPrimary}">${escapeXml(co.number)}</text>
            <text x="28" y="0" font-family="Inter, sans-serif" font-size="13" font-weight="700" fill="${textColorPrimary}">${escapeXml(co.title)}</text>
            <text x="0" y="20" font-family="Inter, sans-serif" font-size="10.5" font-weight="500" fill="${textColorMuted}">${escapeXml(co.description)}</text>
          </g>`;
      }).join("");

      elements.push(
        `<g ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${iso.cornerRadius ?? 14}" fill="${isEditorial ? "#f5f2eb" : cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <text x="${x + 30}" y="${y + 40}" font-family="Inter, sans-serif" font-size="16" font-weight="800" fill="${textColorPrimary}">${escapeXml(iso.title)}</text>
          ${iso.subtitle ? `<text x="${x + 30}" y="${y + 56}" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${textColorMuted}">${escapeXml(iso.subtitle)}</text>` : ""}
          ${isoSvg}
          ${calloutsSvg}
        </g>`
      );
      continue;
    }

    // ─── 9. Graphic Design Venn Timeline (`type: "venn_timeline"`) ────────────
    if (shape.type === "venn_timeline") {
      const vt = shape as VennTimelineShape;
      const spineX = x + w / 2;
      const startY = y + 80;
      const nodeGap = (h - 160) / Math.max(vt.nodes.length - 1, 1);
      
      let elementsSvg = "";
      
      // Spine
      elementsSvg += `<line x1="${spineX}" y1="${startY}" x2="${spineX}" y2="${startY + (vt.nodes.length - 1) * nodeGap}" stroke="${gridLineColor}" stroke-width="2" />`;
      
      vt.nodes.forEach((node, idx) => {
        const ny = startY + idx * nodeGap;
        
        // Render Branches
        if (node.branches) {
          node.branches.forEach((br, bIdx) => {
            const isLeft = br.side === "left";
            const bx = isLeft ? spineX - 120 : spineX + 120;
            const by = ny - 20 + bIdx * 20;
            elementsSvg += `
              <path d="M ${spineX} ${ny} L ${spineX + (isLeft ? -40 : 40)} ${ny} L ${bx} ${by}" fill="none" stroke="${gridLineColor}" stroke-width="1.5" />
              <text x="${bx + (isLeft ? -8 : 8)}" y="${by + 4}" text-anchor="${isLeft ? "end" : "start"}" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="${textColorMuted}">${escapeXml(br.text)}</text>
            `;
          });
        }
        
        // Render Hub
        if (node.vennLabels && node.vennLabels.length === 2) {
          // Two overlapping circles
          elementsSvg += `
            <circle cx="${spineX - 25}" cy="${ny}" r="45" fill="${cardBg}" stroke="${textColorPrimary}" stroke-width="1.5" />
            <circle cx="${spineX + 25}" cy="${ny}" r="45" fill="${cardBg}" stroke="${textColorPrimary}" stroke-width="1.5" opacity="0.9" />
            <text x="${spineX - 40}" y="${ny}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="${textColorPrimary}">${escapeXml(node.vennLabels[0])}</text>
            <text x="${spineX + 40}" y="${ny}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="${textColorPrimary}">${escapeXml(node.vennLabels[1])}</text>
          `;
        } else {
          // Single large circle
          const nodeBg = node.color === "dark" ? textColorPrimary : node.color === "accent" ? "#4A85F6" : cardBg;
          const nodeFg = node.color === "dark" || node.color === "accent" ? cardBg : textColorPrimary;
          elementsSvg += `
            <circle cx="${spineX}" cy="${ny}" r="40" fill="${nodeBg}" stroke="${textColorPrimary}" stroke-width="2" />
            <text x="${spineX}" y="${ny + 4}" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" font-weight="800" fill="${nodeFg}">${escapeXml(node.primaryText)}</text>
          `;
        }
        
        // Primary and Sub text if it's a venn (since single circle renders inside)
        if (node.vennLabels && node.vennLabels.length === 2) {
          elementsSvg += `
            <text x="${spineX}" y="${ny - 55}" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" font-weight="800" fill="${textColorPrimary}">${escapeXml(node.primaryText)}</text>
          `;
        }
        
        elementsSvg += `
          ${node.subText ? `<text x="${spineX}" y="${ny + 60}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="500" fill="${textColorMuted}">${escapeXml(node.subText)}</text>` : ""}
          ${node.number ? `<text x="${x + 40}" y="${ny + 6}" font-family="'JetBrains Mono', monospace" font-size="20" font-weight="800" fill="${gridLineColor}">${escapeXml(node.number)}</text>
          <line x1="${x + 40}" y1="${ny + 16}" x2="${x + w - 40}" y2="${ny + 16}" stroke="${gridLineColor}" stroke-dasharray="4 4" stroke-width="1" />` : ""}
        `;
      });
      
      elements.push(
        `<g ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          ${vt.title ? `<text x="${spineX}" y="${y + 40}" text-anchor="middle" font-family="Inter, sans-serif" font-size="18" font-weight="800" fill="${textColorPrimary}">${escapeXml(vt.title)}</text>` : ""}
          ${elementsSvg}
        </g>`
      );
      continue;
    }

    // ─── 10. Technical HUD Grid (`type: "tech_hud_panel"`) ─────────────────────
    if (shape.type === "tech_hud_panel") {
      const hud = shape as TechHudPanelShape;
      const cols = 4;
      const gap = 8;
      const pad = 16;
      const cellW = (w - pad * 2 - gap * (cols - 1)) / cols;
      const rowH = 60;
      
      let gridSvg = "";
      let curCol = 0;
      let curRow = 0;
      
      hud.gridItems.forEach((item, idx) => {
        const cSpan = Math.min(item.colSpan ?? 1, cols);
        if (curCol + cSpan > cols) {
          curCol = 0;
          curRow++;
        }
        
        const cellX = x + pad + curCol * (cellW + gap);
        const cellY = y + pad + 40 + curRow * (rowH + gap);
        const cW = cellW * cSpan + gap * (cSpan - 1);
        const cH = rowH * (item.rowSpan ?? 1) + gap * ((item.rowSpan ?? 1) - 1);
        
        gridSvg += `
          <g transform="translate(${cellX}, ${cellY})">
            <rect x="0" y="0" width="${cW}" height="${cH}" fill="${isDark ? "#1e293b" : "#f1f5f9"}" stroke="${gridLineColor}" stroke-width="1" />
            <text x="8" y="16" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="600" fill="${textColorMuted}">${escapeXml(item.label.toUpperCase())}</text>
            ${item.value ? `<text x="8" y="${cH - 12}" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="800" fill="${textColorPrimary}">${escapeXml(item.value)}</text>` : ""}
            ${item.barcode ? `
              <g transform="translate(${cW - 60}, 8)">
                <rect x="0" y="0" width="2" height="16" fill="${textColorPrimary}" />
                <rect x="4" y="0" width="4" height="16" fill="${textColorPrimary}" />
                <rect x="10" y="0" width="1" height="16" fill="${textColorPrimary}" />
                <rect x="14" y="0" width="6" height="16" fill="${textColorPrimary}" />
                <rect x="22" y="0" width="2" height="16" fill="${textColorPrimary}" />
                <rect x="26" y="0" width="5" height="16" fill="${textColorPrimary}" />
                <rect x="34" y="0" width="2" height="16" fill="${textColorPrimary}" />
              </g>
            ` : ""}
            ${item.crosshair ? `
              <circle cx="${cW - 20}" cy="${cH / 2}" r="10" fill="none" stroke="${textColorPrimary}" stroke-width="1" />
              <line x1="${cW - 35}" y1="${cH / 2}" x2="${cW - 5}" y2="${cH / 2}" stroke="${textColorPrimary}" stroke-width="1" />
              <line x1="${cW - 20}" y1="${cH / 2 - 15}" x2="${cW - 20}" y2="${cH / 2 + 15}" stroke="${textColorPrimary}" stroke-width="1" />
            ` : ""}
          </g>
        `;
        
        curCol += cSpan;
      });
      
      elements.push(
        `<g ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0" fill="${cardBg}" stroke="${textColorPrimary}" stroke-width="2" />
          <rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" fill="none" stroke="${gridLineColor}" stroke-width="1" />
          <text x="${x + pad}" y="${y + pad + 16}" font-family="'JetBrains Mono', monospace" font-size="24" font-weight="900" fill="${textColorPrimary}">${escapeXml(hud.title.toUpperCase())}</text>
          <line x1="${x}" y1="${y + 40}" x2="${x + w}" y2="${y + 40}" stroke="${textColorPrimary}" stroke-width="2" />
          ${gridSvg}
        </g>`
      );
      continue;
    }

    // ─── 11. Layered Process Map (`type: "layered_process_map"`) ───────────────
    if (shape.type === "layered_process_map") {
      const pm = shape as LayeredProcessMapShape;
      const zoneW = w - 40;
      const zoneH = (h - 80) / Math.max(pm.zones.length, 1);
      
      let pmSvg = "";
      
      // Render Zones
      pm.zones.forEach((z, idx) => {
        const zy = y + 60 + idx * zoneH;
        pmSvg += `
          <rect x="${x + 20}" y="${zy}" width="${zoneW}" height="${zoneH - 10}" rx="12" fill="none" stroke="${z.color ?? gridLineColor}" stroke-dasharray="6,6" stroke-width="2" />
          <text x="${x + 40}" y="${zy + 30}" font-family="Inter, sans-serif" font-size="14" font-weight="800" fill="${z.color ?? textColorMuted}">${escapeXml(z.label.toUpperCase())}</text>
        `;
      });
      
      // Map nodes to coordinates
      const nodeCoords: Record<string, {x: number, y: number}> = {};
      pm.nodes.forEach((n, idx) => {
        const zIdx = pm.zones.findIndex(z => z.id === n.zoneId);
        const validZIdx = zIdx === -1 ? 0 : zIdx;
        const zy = y + 60 + validZIdx * zoneH;
        
        // Just place them in a simple grid within their zone
        const nodesInZone = pm.nodes.filter(n2 => n2.zoneId === n.zoneId);
        const myLocalIdx = nodesInZone.findIndex(n2 => n2.id === n.id);
        const cols = Math.max(Math.ceil(nodesInZone.length / 2), 3);
        
        const cellW = zoneW / cols;
        const nx = x + 20 + (myLocalIdx % cols) * cellW + cellW / 2;
        const ny = zy + 60 + Math.floor(myLocalIdx / cols) * 80;
        
        nodeCoords[n.id] = { x: nx, y: ny };
        
        let iconSvg = "";
        if (n.icon === "people") {
          iconSvg = `<circle cx="${nx - 12}" cy="${ny - 4}" r="3" fill="${textColorPrimary}"/><rect x="${nx - 16}" y="${ny}" width="8" height="12" rx="2" fill="${textColorPrimary}"/><circle cx="${nx}" cy="${ny - 4}" r="3" fill="${textColorPrimary}"/><rect x="${nx - 4}" y="${ny}" width="8" height="12" rx="2" fill="${textColorPrimary}"/><circle cx="${nx + 12}" cy="${ny - 4}" r="3" fill="${textColorPrimary}"/><rect x="${nx + 8}" y="${ny}" width="8" height="12" rx="2" fill="${textColorPrimary}"/>`;
        } else {
          iconSvg = `<circle cx="${nx}" cy="${ny}" r="16" fill="${cardBg}" stroke="${textColorPrimary}" stroke-width="2" />`;
        }
        
        pmSvg += `
          ${iconSvg}
          <text x="${nx}" y="${ny + 24}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="${textColorMuted}">${escapeXml(n.label)}</text>
        `;
      });
      
      // Render Connections
      (pm.connections ?? []).forEach(c => {
        const from = nodeCoords[c.from];
        const to = nodeCoords[c.to];
        if (!from || !to) return;
        
        const midY = (from.y + to.y) / 2;
        const path = `M ${from.x} ${from.y + 16} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y - 16}`;
        const dash = c.style === "dotted" ? "stroke-dasharray='4,4'" : "";
        pmSvg += `
          <path d="${path}" fill="none" stroke="${c.color ?? textColorPrimary}" stroke-width="1.5" ${dash} />
          <circle cx="${to.x}" cy="${to.y - 16}" r="3" fill="${c.color ?? textColorPrimary}" />
        `;
      });
      
      elements.push(
        `<g ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0" fill="${isEditorial ? "#f5f2eb" : cardBg}" stroke="${stroke}" stroke-width="0" />
          <text x="${x + w / 2}" y="${y + 30}" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" font-weight="900" fill="${textColorPrimary}">${escapeXml(pm.title.toUpperCase())}</text>
          ${pmSvg}
        </g>`
      );
      continue;
    }

    // ─── Step Timeline (`type: "step_timeline"`) — vertical alternating timeline poster ───
    if (shape.type === "step_timeline") {
      const st = shape as StepTimelineShape;
      const accent = st.accentColor ?? "#1e3a8a";
      const titleColor = darkenHex(accent, 0.3);
      const top = st.title ? 70 : 16;
      const n = Math.max(1, st.steps.length);
      const stepH = (h - top) / n;
      const cx = x + w / 2;

      const badgeR = 28;
      const edgeInset = 36;
      const textInset = 90;
      const blockW = Math.max(40, w / 2 - 150);
      const descFontSize = 13;

      let stSvg = "";
      if (st.background && st.background !== "transparent") {
        stSvg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${st.background}" />`;
      }
      if (st.title) {
        stSvg += `<text x="${cx}" y="${y + 44}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="30" font-weight="800" fill="${textColorPrimary}">${escapeXml(st.title)}</text>`;
      }
      stSvg += `<line x1="${cx}" y1="${y + top}" x2="${cx}" y2="${y + h}" stroke="${accent}" stroke-width="2" />`;

      st.steps.forEach((step, idx) => {
        const isLeft = idx % 2 === 0;
        const ay = y + top + idx * stepH + 24;
        const badgeCx = isLeft ? x + edgeInset : x + w - edgeInset;
        const leaderEndX = isLeft ? badgeCx + badgeR : badgeCx - badgeR;
        const textAnchor = isLeft ? "start" : "end";
        const textX = isLeft ? cx + textInset : cx - textInset;

        stSvg += `<circle cx="${cx}" cy="${ay}" r="3" fill="${accent}" />`;
        stSvg += `<line x1="${cx}" y1="${ay}" x2="${leaderEndX}" y2="${ay}" stroke="${accent}" stroke-width="1.5" stroke-dasharray="4,4" />`;
        stSvg += `<circle cx="${badgeCx}" cy="${ay}" r="${badgeR}" fill="${accent}" />`;
        stSvg += `<text x="${badgeCx}" y="${ay + 7}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="20" font-weight="800" fill="#ffffff">${idx + 1}</text>`;

        const eyebrow = (step.label ?? `STEP ${idx + 1}`).toUpperCase();
        stSvg += `<text x="${textX}" y="${ay - 22}" text-anchor="${textAnchor}" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="700" letter-spacing="0.08em" fill="${accent}">${escapeXml(eyebrow)}</text>`;
        stSvg += `<text x="${textX}" y="${ay - 2}" text-anchor="${textAnchor}" font-family="Inter, -apple-system, sans-serif" font-size="22" font-weight="800" fill="${titleColor}">${escapeXml(step.title)}</text>`;

        if (step.description) {
          const approxCharW = descFontSize * 0.55;
          const maxChars = Math.max(4, Math.floor(blockW / approxCharW));
          const words = step.description.split(" ");
          const lines: string[] = [];
          let cur = "";
          for (const word of words) {
            const candidate = cur ? `${cur} ${word}` : word;
            if (candidate.length > maxChars && cur) {
              lines.push(cur);
              cur = word;
            } else {
              cur = candidate;
            }
          }
          if (cur) lines.push(cur);
          // Each step owns stepH of vertical room; clamp to what actually fits, not a constant.
          const maxLines = Math.max(2, Math.floor((stepH - 90) / 16));
          const clipped = lines.slice(0, maxLines);
          if (clipped.length < lines.length) {
            clipped[clipped.length - 1] = clipped[clipped.length - 1].replace(/,?\s*$/, "") + "…";
          }
          const descTspans = clipped
            .map((line, lIdx) => `<tspan x="${textX}" dy="${lIdx === 0 ? 0 : 16}">${escapeXml(line)}</tspan>`)
            .join("");
          stSvg += `<text x="${textX}" y="${ay + 18}" text-anchor="${textAnchor}" font-family="Inter, sans-serif" font-size="${descFontSize}" font-weight="500" fill="#475569">${descTspans}</text>`;
        }
      });

      elements.push(`<g ${opacity}>${stSvg}</g>`);
      continue;
    }

    // ─── Mesh Connector (`type: "mesh_connector"`) — dense many-to-many crosshatch fan ───
    if (shape.type === "mesh_connector") {
      const mc = shape as MeshConnectorShape;
      const fromCount = Math.floor(mc.fromCount ?? 0);
      const toCount = Math.floor(mc.toCount ?? 0);
      if (fromCount <= 0 || toCount <= 0) continue;

      const orientation = mc.orientation ?? "horizontal";
      const insetX = w * 0.1;
      const insetY = h * 0.1;
      const lineStroke = mc.lineColor ?? (isDark ? "#475569" : "#94a3b8");
      const lineOpacity = mc.lineOpacity ?? 0.15;
      const dotFill = mc.dotColor ?? textColorMuted;
      const dotRadius = mc.dotRadius ?? 3;

      const fromPoints: { x: number; y: number }[] = [];
      const toPoints: { x: number; y: number }[] = [];

      if (orientation === "vertical") {
        for (let i = 0; i < fromCount; i++) {
          const px = fromCount === 1 ? x + w / 2 : x + insetX + (i * (w - 2 * insetX)) / (fromCount - 1);
          fromPoints.push({ x: px, y: y + insetY });
        }
        for (let i = 0; i < toCount; i++) {
          const px = toCount === 1 ? x + w / 2 : x + insetX + (i * (w - 2 * insetX)) / (toCount - 1);
          toPoints.push({ x: px, y: y + h - insetY });
        }
      } else {
        for (let i = 0; i < fromCount; i++) {
          const py = fromCount === 1 ? y + h / 2 : y + insetY + (i * (h - 2 * insetY)) / (fromCount - 1);
          fromPoints.push({ x: x + insetX, y: py });
        }
        for (let i = 0; i < toCount; i++) {
          const py = toCount === 1 ? y + h / 2 : y + insetY + (i * (h - 2 * insetY)) / (toCount - 1);
          toPoints.push({ x: x + w - insetX, y: py });
        }
      }

      const meshLines: string[] = [];
      for (const fp of fromPoints) {
        for (const tp of toPoints) {
          meshLines.push(`<line x1="${fp.x.toFixed(2)}" y1="${fp.y.toFixed(2)}" x2="${tp.x.toFixed(2)}" y2="${tp.y.toFixed(2)}" stroke="${lineStroke}" stroke-width="0.6" opacity="${lineOpacity}" />`);
        }
      }
      const meshDots: string[] = [];
      for (const p of [...fromPoints, ...toPoints]) {
        meshDots.push(`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${dotRadius}" fill="${dotFill}" />`);
      }

      elements.push(`<g ${opacity}>${meshLines.join("")}${meshDots.join("")}</g>`);
      continue;
    }

    // ─── Dot Matrix (`type: "dot_matrix"`) — halftone portraits, dithered art, dot-density charts ───
    if (shape.type === "dot_matrix") {
      const dm = shape as DotMatrixShape;
      const rows = dm.rows ?? [];
      const nRows = rows.length;
      const nCols = Math.max(1, ...rows.map((r) => r.length));
      if (nRows === 0) continue;
      const cellW = w / nCols;
      const cellH = h / nRows;
      const maxR = Math.min(cellW, cellH) / 2;
      const RAMP = " .:-=+*#%@";
      const on = dm.dotColor ?? (isDark ? "#f8fafc" : "#0f172a");
      const glyph = dm.glyph ?? "circle";

      const dots: string[] = [];
      if (dm.background) dots.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${dm.background}" />`);
      for (let ri = 0; ri < nRows; ri++) {
        for (let ci = 0; ci < rows[ri].length; ci++) {
          const ch = rows[ri][ci];
          const density = ch >= "0" && ch <= "9" ? Number(ch) / 9 : Math.max(0, RAMP.indexOf(ch)) / (RAMP.length - 1);
          if (density <= 0) {
            if (dm.offColor) {
              const r0 = maxR * 0.18;
              dots.push(`<circle cx="${x + (ci + 0.5) * cellW}" cy="${y + (ri + 0.5) * cellH}" r="${r0.toFixed(2)}" fill="${dm.offColor}" />`);
            }
            continue;
          }
          const r = maxR * (0.25 + 0.75 * density);
          const cx = x + (ci + 0.5) * cellW;
          const cy = y + (ri + 0.5) * cellH;
          if (glyph === "square") {
            dots.push(`<rect x="${(cx - r).toFixed(2)}" y="${(cy - r).toFixed(2)}" width="${(2 * r).toFixed(2)}" height="${(2 * r).toFixed(2)}" fill="${on}" />`);
          } else if (glyph === "diamond") {
            dots.push(`<rect x="${(cx - r).toFixed(2)}" y="${(cy - r).toFixed(2)}" width="${(2 * r).toFixed(2)}" height="${(2 * r).toFixed(2)}" fill="${on}" transform="rotate(45 ${cx.toFixed(2)} ${cy.toFixed(2)})" />`);
          } else {
            dots.push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${on}" />`);
          }
        }
      }
      elements.push(`<g ${opacity}>${dots.join("")}</g>`);
      continue;
    }

    // ─── 12. Image Shape ───────────────────────────────────────────────────────
    if (shape.type === "image") {
      const img = shape as ImageShape;
      const rx = img.cornerRadius ?? 10;
      const clipId = `clip-${img.id}`;
      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <clipPath id="${clipId}">
            <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" />
          </clipPath>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${isDark ? "#1e293b" : "#f1f5f9"}" />
          <image href="${img.src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />
        </g>`
      );
      continue;
    }

    // ─── 10. Architecture Card Shape (`type: "card"`) ────────────────────────
    if (shape.type === "card") {
      const card = shape as CardShape;
      const iconName = card.icon ?? "server";
      const iconColor = card.stroke ? resolveColor(card.stroke) ?? card.stroke : isDark ? "#60a5fa" : "#4A85F6";
      const badgeText = card.badge?.text ?? card.role ?? "";
      const badgeBg = card.badge?.bg ?? (isDark ? "rgba(37,99,235,0.2)" : "#eff6ff");
      const badgeColor = card.badge?.color ?? (isDark ? "#93c5fd" : "#1d4ed8");

      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${card.cornerRadius ?? 10}" fill="${cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <rect x="${x}" y="${y}" width="${w}" height="42" rx="${card.cornerRadius ?? 10}" fill="${fill === "none" ? (isDark ? "#1e293b" : "#f8fafc") : fill}" />
          <rect x="${x}" y="${y + 32}" width="${w}" height="10" fill="${fill === "none" ? (isDark ? "#1e293b" : "#f8fafc") : fill}" />
          <line x1="${x}" y1="${y + 42}" x2="${x + w}" y2="${y + 42}" stroke="${isDark ? "#334155" : "#e2e8f0"}" stroke-width="1" />
          <g transform="translate(${x + 10}, ${y + 9})">
            <rect x="0" y="0" width="24" height="24" rx="6" fill="${cardBg}" stroke="${cardBorder}" stroke-width="1" />
            <g transform="translate(4, 4) scale(0.66)">
              ${getSvgIcon(iconName, 16, iconColor)}
            </g>
          </g>
          <text x="${x + 40}" y="${y + 25}" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="700" fill="${textColorPrimary}">${escapeXml(card.title)}</text>
          ${badgeText ? `
          <g transform="translate(${x + w - 12}, ${y + 21})">
            <rect x="-${badgeText.length * 6 + 12}" y="-9" width="${badgeText.length * 6 + 12}" height="18" rx="4" fill="${badgeBg}" />
            <text x="-${(badgeText.length * 6 + 12) / 2}" y="3.5" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="9.5" font-weight="700" fill="${badgeColor}">${escapeXml(badgeText)}</text>
          </g>` : ""}
          ${card.subtitle ? `
          <text x="${x + 12}" y="${y + 60}" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="500" fill="${textColorMuted}">${escapeXml(card.subtitle)}</text>` : ""}
          ${(card.metadata ?? []).map((m, idx) => `
          <g transform="translate(${x + 12}, ${y + 78 + idx * 18})">
            <circle cx="3" cy="-3" r="2" fill="${isDark ? "#64748b" : "#94a3b8"}" />
            <text x="10" y="0" font-family="Inter, -apple-system, sans-serif" font-size="10.5" font-weight="600" fill="${textColorMuted}">${escapeXml(m.label)}:</text>
            <text x="${12 + m.label.length * 6.5}" y="0" font-family="Inter, -apple-system, sans-serif" font-size="10.5" font-weight="500" fill="${textColorPrimary}">${escapeXml(m.value)}</text>
          </g>`).join("")}
          ${cardBodyTspans(card, shape.text?.content, x, y, w, textColorMuted)}
        </g>`
      );
      continue;
    }

    // ─── 11. Database Schema Table Shape (`type: "table"`) ───────────────────
    if (shape.type === "table") {
      const table = shape as TableShape;
      const headerBg = table.headerBg ? resolveColor(table.headerBg) ?? table.headerBg : (isDark ? "#1e293b" : "#f1f5f9");
      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${table.cornerRadius ?? 8}" fill="${cardBg}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <rect x="${x}" y="${y}" width="${w}" height="34" rx="${table.cornerRadius ?? 8}" fill="${headerBg}" />
          <rect x="${x}" y="${y + 24}" width="${w}" height="10" fill="${headerBg}" />
          <line x1="${x}" y1="${y + 34}" x2="${x + w}" y2="${y + 34}" stroke="${isDark ? "#334155" : "#cbd5e1"}" stroke-width="1.2" />
          <g transform="translate(${x + 10}, ${y + 9}) scale(0.66)">
            ${getSvgIcon("database", 16, isDark ? "#94a3b8" : "#334155")}
          </g>
          <text x="${x + 30}" y="${y + 22}" font-family="'JetBrains Mono', Inter, monospace" font-size="12" font-weight="700" fill="${textColorPrimary}">${escapeXml(table.tableName)}</text>
          ${table.columns.map((col, idx) => {
            const rowY = y + 54 + idx * 22;
            const badge = col.isPk ? `<rect x="${x + 8}" y="${rowY - 10}" width="20" height="14" rx="3" fill="${isDark ? "#78350f" : "#fef3c7"}"/><text x="${x + 18}" y="${rowY}" text-anchor="middle" font-family="Inter, sans-serif" font-size="8.5" font-weight="800" fill="${isDark ? "#fde68a" : "#b45309"}">PK</text>` : col.isFk ? `<rect x="${x + 8}" y="${rowY - 10}" width="20" height="14" rx="3" fill="${isDark ? "#0c4a6e" : "#e0f2fe"}"/><text x="${x + 18}" y="${rowY}" text-anchor="middle" font-family="Inter, sans-serif" font-size="8.5" font-weight="800" fill="${isDark ? "#bae6fd" : "#0369a1"}">FK</text>` : `<circle cx="${x + 18}" cy="${rowY - 3}" r="2" fill="${isDark ? "#475569" : "#cbd5e1"}"/>`;
            return `
            <g>
              ${badge}
              <text x="${x + 34}" y="${rowY}" font-family="'JetBrains Mono', Inter, monospace" font-size="11" font-weight="600" fill="${textColorPrimary}">${escapeXml(col.name)}</text>
              <text x="${x + w - 10}" y="${rowY}" text-anchor="end" font-family="'JetBrains Mono', Inter, monospace" font-size="10.5" font-weight="500" fill="${textColorMuted}">${escapeXml(col.type)}</text>
            </g>`;
          }).join("")}
        </g>`
      );
      continue;
    }

    // ─── 12. Icon Pictogram (`type: "pictogram"`) ─────────────────────────────
    if (shape.type === "pictogram") {
      const pg = shape as PictogramShape;
      const color = (pg.stroke ? resolveColor(pg.stroke) ?? pg.stroke : pg.fill ? resolveColor(pg.fill) ?? pg.fill : undefined) ?? "#1e293b";
      const size = Math.min(w, h);
      const iconX = x + (w - size) / 2;
      const iconY = y + (h - size) / 2;
      elements.push(
        `<g transform="translate(${iconX}, ${iconY}) scale(${size / 24})" stroke="${color}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${opacity}>
          ${getPictogram(pg.icon)}
        </g>`
      );
      continue;
    }

    // ─── 13. Pictogram Row / Human-Graph (`type: "pictogram_row"`) ────────────
    if (shape.type === "pictogram_row") {
      const pr = shape as PictogramRowShape;
      const count = Math.max(1, pr.count);
      const filledColor = pr.color ?? "#e05252";
      const mutedColor = pr.mutedColor ?? (isDark ? "#334155" : "#d5d9e0");

      let iconSize = Math.min(h, w);
      let gap = count > 1 ? (w - count * iconSize) / (count - 1) : 0;
      if (count > 1 && gap < 4) {
        iconSize = (w - (count - 1) * 4) / count;
        gap = 4;
      }

      const iconsSvg = Array.from({ length: count }, (_, i) => {
        const iconX = x + i * (iconSize + gap);
        const iconY = y + (h - iconSize) / 2;
        const iconColor = i < pr.filled ? filledColor : mutedColor;
        return `<g transform="translate(${iconX}, ${iconY}) scale(${iconSize / 24})" stroke="${iconColor}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${getPictogram(pr.icon)}
        </g>`;
      }).join("");

      elements.push(`<g ${opacity}>${iconsSvg}</g>`);
      continue;
    }

    // ─── Universal Geometric Shapes ───────────────────────────────────────────
    switch (shape.type) {
      case "rectangle":
      case "sticky": {
        const rx = shape.type === "sticky" ? 4 : (shape as RectShape).cornerRadius ?? 8;
        elements.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${shadowFilter} ${opacity} />`
        );
        break;
      }
      case "diamond": {
        const pts = `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`;
        elements.push(
          `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" ${strokeDash} ${shadowFilter} ${opacity} />`
        );
        break;
      }
      case "triangle": {
        const pts = `${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`;
        elements.push(
          `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" ${strokeDash} ${shadowFilter} ${opacity} />`
        );
        break;
      }
      case "cylinder": {
        const ry = h * 0.15;
        const cyTop = y + ry;
        const cyBottom = y + h - ry;
        elements.push(
          `<g ${shadowFilter} ${opacity}>
            <path d="M ${x} ${cyTop} L ${x} ${cyBottom} A ${w / 2} ${ry} 0 0 0 ${x + w} ${cyBottom} L ${x + w} ${cyTop} Z" fill="${fill}" stroke="none" />
            <path d="M ${x} ${cyBottom} A ${w / 2} ${ry} 0 0 0 ${x + w} ${cyBottom}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <line x1="${x}" y1="${cyTop}" x2="${x}" y2="${cyBottom}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <line x1="${x + w}" y1="${cyTop}" x2="${x + w}" y2="${cyBottom}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <ellipse cx="${x + w / 2}" cy="${cyTop}" rx="${w / 2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          </g>`
        );
        break;
      }
      case "cloud": {
        const pathData = `M ${x + w * 0.25} ${y + h * 0.75} C ${x + w * 0.05} ${y + h * 0.75} ${x + w * 0.05} ${y + h * 0.35} ${x + w * 0.3} ${y + h * 0.35} C ${x + w * 0.35} ${y + h * 0.1} ${x + w * 0.65} ${y + h * 0.1} ${x + w * 0.7} ${y + h * 0.35} C ${x + w * 0.95} ${y + h * 0.35} ${x + w * 0.95} ${y + h * 0.75} ${x + w * 0.75} ${y + h * 0.75} Z`;
        elements.push(
          `<path d="${pathData}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${shadowFilter} ${opacity} />`
        );
        break;
      }
      case "hexagon": {
        const pts = `${x + w * 0.25},${y} ${x + w * 0.75},${y} ${x + w},${y + h * 0.5} ${x + w * 0.75},${y + h} ${x + w * 0.25},${y + h} ${x},${y + h * 0.5}`;
        elements.push(
          `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" ${strokeDash} ${shadowFilter} ${opacity} />`
        );
        break;
      }
      case "star": {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const outerR = Math.min(w, h) / 2;
        const innerR = outerR * 0.45;
        const starPoints: string[] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          starPoints.push(`${Math.round(cx + r * Math.cos(angle))},${Math.round(cy + r * Math.sin(angle))}`);
        }
        elements.push(
          `<polygon points="${starPoints.join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" ${strokeDash} ${shadowFilter} ${opacity} />`
        );
        break;
      }
      case "ellipse": {
        elements.push(
          `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${shadowFilter} ${opacity} />`
        );
        break;
      }
      case "frame": {
        elements.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="6,4" ${opacity} />
          <rect x="${x + 10}" y="${y - 12}" width="${Math.max(70, (shape.name?.length ?? 0) * 8 + 20)}" height="22" rx="5" fill="${cardBg}" stroke="${cardBorder}" stroke-width="1" />
          <text x="${x + 20}" y="${y + 3}" font-family="Inter, -apple-system, sans-serif" font-size="11.5" font-weight="700" fill="${textColorMuted}">${escapeXml(shape.name ?? "")}</text>`
        );
        break;
      }
    }

    if (shape.text?.content) {
      const textColor = shape.text.color ?? (shape.type === "sticky" ? "#713f12" : textColorPrimary);
      // A bare text shape has no box to spill out of; only container shapes fit.
      const fontSize =
        shape.type === "text"
          ? shape.text.fontSize ?? 13
          : fitTextFontSize({
              content: shape.text.content,
              width: w,
              height: h,
              fontSize: shape.text.fontSize ?? 13,
              bold: shape.text.bold,
              wrap: shape.text.wrap,
            });
      const fontWeight = shape.text.bold ? "700" : "500";
      // Konva honors text.fontFamily; the exporter must too or WYSIWYG breaks.
      const fontFamily = shape.text.fontFamily ?? "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const align = shape.text.align ?? (shape.type === "text" ? "left" : "center");
      const textAnchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - 12 : x + 12;

      // Konva wraps text to the shape width; mirror that here or copy overflows the
      // shape in export. Approximate glyph width since string-built SVG can't measure.
      const availW = Math.max(24, w - 24);
      const approxCharW = fontSize * (shape.text.bold ? 0.58 : 0.55);
      const maxChars = Math.max(4, Math.floor(availW / approxCharW));
      const noWrap = shape.text.wrap === false;
      const richText = !noWrap && hasRichTextMarkers(shape.text.content);

      if (richText) {
        const richLines = layoutRichTextLines(shape.text.content, { maxWidth: availW, fontSize, bold: shape.text.bold });
        const lineHeight = fontSize * 1.35;
        const totalTextHeight = richLines.length * lineHeight;
        const yOffset = shape.type === "cylinder" ? h * 0.1 : 0;
        const startY = y + yOffset + (h - yOffset) / 2 - totalTextHeight / 2 + fontSize * 0.85;

        const tspans = richLines
          .map((line, idx) => {
            const lineY = Math.round(startY + idx * lineHeight);
            const lineWidth = line.runs.reduce((sum, run) => sum + measureRunWidth(run, fontSize, shape.text?.bold), 0);
            const lineStartX = align === "center" ? tx - lineWidth / 2 : align === "right" ? tx - lineWidth : tx;
            let runX = lineStartX;
            const runSpans = line.runs.map((run) => {
              const runWidth = measureRunWidth(run, fontSize, shape.text?.bold);
              const bold = shape.text?.bold || run.bold;
              const italic = run.italic;
              if (run.highlight) {
                elements.push(
                  `<rect x="${runX}" y="${lineY - fontSize * 0.85}" width="${runWidth}" height="${fontSize * 1.2}" fill="${RICH_TEXT_HIGHLIGHT_FILL}" opacity="${RICH_TEXT_HIGHLIGHT_OPACITY}" />`
                );
              }
              const span = `<tspan x="${runX}" y="${lineY}" font-weight="${bold ? "700" : "500"}" font-style="${italic ? "italic" : "normal"}">${escapeXml(run.text)}</tspan>`;
              runX += runWidth;
              return span;
            });
            return runSpans.join("");
          })
          .join("");

        elements.push(
          `<text xml:space="preserve" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" fill="${textColor}" text-anchor="start">${tspans}</text>`
        );
      } else {
        const lines = noWrap ? shape.text.content.split("\n") : wrapTextLines(shape.text.content, maxChars);
        const lineHeight = fontSize * 1.35;
        const totalTextHeight = lines.length * lineHeight;
        const yOffset = shape.type === "cylinder" ? h * 0.1 : 0;
        const startY = y + yOffset + (h - yOffset) / 2 - totalTextHeight / 2 + fontSize * 0.85;

        const tspans = lines
          .map((line, idx) => `<tspan x="${tx}" y="${Math.round(startY + idx * lineHeight)}">${escapeXml(line)}</tspan>`)
          .join("");

        elements.push(
          `<text xml:space="preserve" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${textColor}" text-anchor="${textAnchor}">${tspans}</text>`
        );
      }
    }
  }

  if (options?.bare) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}" preserveAspectRatio="xMidYMid meet">
  ${defs}
  ${elements.join("\n  ")}
</svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" style="background:${canvasBg};border-radius:14px;box-shadow:inset 0 0 0 1px ${isDark ? "rgba(255,255,255,0.08)" : isEditorial ? "#e2ded4" : "#e2e8f0"};max-width:100%;display:block;">
  ${defs}
  <pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1" fill="${dotColor}" />
  </pattern>
  <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#dot-grid)" opacity="${isDark ? "0.4" : "0.65"}" />
  ${elements.join("\n  ")}
</svg>`;
}
