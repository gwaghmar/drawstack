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
  type ChartShape,
  type MockupShape,
  resolveArrowRenderEndpoints,
  getShapeBounds,
  resolveColor,
  isBoundEndpoint,
} from "./freeform-canvas.ts";
import { getStroke } from "perfect-freehand";

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

// ─── Real Multi-Color Cloud & Tech Brand Icons ──────────────────────────────
export function getSvgIcon(iconName: string, size = 16, color = "#6366f1"): string {
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
    default:
      return `<path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
  }
}

// ─── Smooth Rounded Fillet Orthogonal Router ────────────────────────────────
function generateSmoothOrthogonalPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startAnchor?: string,
  endAnchor?: string,
  filletRadius = 8
): string {
  const points: { x: number; y: number }[] = [{ x: start.x, y: start.y }];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  if (startAnchor === "top" || startAnchor === "bottom") {
    const stubY = startAnchor === "top" ? start.y - Math.min(30, Math.abs(dy) / 2) : start.y + Math.min(30, Math.abs(dy) / 2);
    points.push({ x: start.x, y: stubY });
    if (endAnchor === "left" || endAnchor === "right") {
      points.push({ x: start.x, y: end.y });
    } else {
      const midX = Math.round((start.x + end.x) / 2);
      points.push({ x: midX, y: stubY });
      points.push({ x: midX, y: end.y });
    }
  } else if (startAnchor === "left" || startAnchor === "right") {
    const stubX = startAnchor === "left" ? start.x - Math.min(30, Math.abs(dx) / 2) : start.x + Math.min(30, Math.abs(dx) / 2);
    points.push({ x: stubX, y: start.y });
    if (endAnchor === "top" || endAnchor === "bottom") {
      points.push({ x: end.x, y: start.y });
    } else {
      const midX = Math.round((start.x + end.x) / 2);
      points.push({ x: midX, y: start.y });
      points.push({ x: midX, y: end.y });
    }
  } else {
    const midX = Math.round((start.x + end.x) / 2);
    points.push({ x: midX, y: start.y });
    points.push({ x: midX, y: end.y });
  }
  points.push({ x: end.x, y: end.y });

  let pathStr = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const pPrev = points[i - 1];
    const pCurr = points[i];
    const pNext = points[i + 1];

    const d1x = pCurr.x - pPrev.x;
    const d1y = pCurr.y - pPrev.y;
    const len1 = Math.hypot(d1x, d1y);

    const d2x = pNext.x - pCurr.x;
    const d2y = pNext.y - pCurr.y;
    const len2 = Math.hypot(d2x, d2y);

    const r = Math.min(filletRadius, len1 / 2, len2 / 2);

    const pStartTurn = {
      x: pCurr.x - (d1x / len1) * r,
      y: pCurr.y - (d1y / len1) * r,
    };
    const pEndTurn = {
      x: pCurr.x + (d2x / len2) * r,
      y: pCurr.y + (d2y / len2) * r,
    };

    pathStr += ` L ${Math.round(pStartTurn.x)} ${Math.round(pStartTurn.y)}`;
    pathStr += ` Q ${pCurr.x} ${pCurr.y} ${Math.round(pEndTurn.x)} ${Math.round(pEndTurn.y)}`;
  }
  pathStr += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return pathStr;
}

export function freeformToSvg(doc: CanvasDocument): string {
  if (doc.shapes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><text x="200" y="150" text-anchor="middle" fill="#94a3b8" font-family="Inter, sans-serif" font-size="14">Empty Canvas</text></svg>`;
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const shape of doc.shapes) {
    const b = getShapeBounds(doc, shape);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  const padding = 60;
  const vx = Math.round(minX - padding);
  const vy = Math.round(minY - padding);
  const vw = Math.max(100, Math.round(maxX - minX + padding * 2));
  const vh = Math.max(100, Math.round(maxY - minY + padding * 2));

  const defs = `
  <defs>
    <!-- Multi-layer Soft Physical Drop Shadows -->
    <filter id="soft-card-shadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.08" />
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.04" />
    </filter>
    <filter id="pill-shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.06" />
    </filter>
    <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0"/>
    </linearGradient>
    <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
    </linearGradient>
    <marker id="arrowhead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#64748b" />
    </marker>
    <marker id="arrowhead-start" viewBox="0 0 10 10" refX="1.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 8.5 1.5 L 0 5 L 8.5 8.5 z" fill="#64748b" />
    </marker>
  </defs>`;

  const elements: string[] = [];

  for (const shape of doc.shapes) {
    const rawFill = shape.fill ? resolveColor(shape.fill) ?? shape.fill : shape.type === "sticky" ? "#fef08a" : "#ffffff";
    const fill = rawFill === "transparent" ? "none" : rawFill;
    const stroke = shape.stroke ? resolveColor(shape.stroke) ?? shape.stroke : shape.type === "frame" ? "#cbd5e1" : "#334155";
    const strokeWidth = shape.strokeWidth ?? 1.5;
    const opacity = shape.opacity !== undefined ? `opacity="${shape.opacity}"` : "";
    const strokeDash =
      shape.strokeDash === "dashed"
        ? 'stroke-dasharray="8,6"'
        : shape.strokeDash === "dotted"
          ? 'stroke-dasharray="3,4"'
          : "";

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

    if (shape.type === "arrow" || shape.type === "line") {
      const arrow = shape as ArrowShape;
      const { start, end } = resolveArrowRenderEndpoints(doc, arrow);
      const markerEnd = shape.type === "arrow" && arrow.arrowEnd !== false ? 'marker-end="url(#arrowhead)"' : "";
      const markerStart = shape.type === "arrow" && arrow.arrowStart ? 'marker-start="url(#arrowhead-start)"' : "";

      const startAnchor = isBoundEndpoint(arrow.start) ? arrow.start.anchor : undefined;
      const endAnchor = isBoundEndpoint(arrow.end) ? arrow.end.anchor : undefined;

      let pathD: string;
      if (arrow.routing === "orthogonal") {
        pathD = generateSmoothOrthogonalPath(start, end, startAnchor, endAnchor, 8);
      } else {
        pathD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      }

      elements.push(
        `<path d="${pathD}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${strokeDash} fill="none" ${markerStart} ${markerEnd} ${opacity} />`
      );

      if (arrow.label) {
        const midX = Math.round((start.x + end.x) / 2);
        const midY = Math.round((start.y + end.y) / 2);
        const labelWidth = Math.max(52, arrow.label.length * 7.5 + 18);
        elements.push(
          `<g transform="translate(${midX}, ${midY})">
            <rect x="-${labelWidth / 2}" y="-11" width="${labelWidth}" height="22" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" filter="url(#pill-shadow)" />
            <text x="0" y="4" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#475569">${escapeXml(arrow.label)}</text>
          </g>`
        );
      }
      continue;
    }

    const w = (shape as RectShape).width;
    const h = (shape as RectShape).height;
    const x = shape.x;
    const y = shape.y;
    const shadowFilter = shape.type === "sticky" ? 'filter="url(#soft-card-shadow)"' : shape.type !== "frame" ? 'filter="url(#soft-card-shadow)"' : "";

    // ─── 1. Embedded Image / Picture Shape (`type: "image"`) ─────────────────
    if (shape.type === "image") {
      const img = shape as ImageShape;
      const rx = img.cornerRadius ?? 10;
      const clipId = `clip-${img.id}`;
      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <clipPath id="${clipId}">
            <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" />
          </clipPath>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#f1f5f9" />
          <image href="${img.src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />
        </g>`
      );
      continue;
    }

    // ─── 2. Metric / KPI Stat Card (`type: "metric"`) ────────────────────────
    if (shape.type === "metric") {
      const m = shape as MetricShape;
      const deltaColor = m.deltaDirection === "down" ? "#ef4444" : "#10b981";
      const deltaBg = m.deltaDirection === "down" ? "#fee2e2" : "#d1fae5";
      const iconName = m.icon ?? "activity";

      // Sparkline generation
      const pts = m.sparkline ?? [10, 25, 18, 30, 24, 42, 38, 55];
      const sparkW = 80;
      const sparkH = 30;
      const minV = Math.min(...pts);
      const maxV = Math.max(...pts);
      const range = maxV - minV || 1;
      const sparkX0 = x + w - sparkW - 16;
      const sparkY0 = y + h - sparkH - 16;

      const sparkPoints = pts.map((val, idx) => {
        const px = sparkX0 + (idx / (pts.length - 1)) * sparkW;
        const py = sparkY0 + sparkH - ((val - minV) / range) * sparkH;
        return `${Math.round(px)},${Math.round(py)}`;
      });

      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${m.cornerRadius ?? 10}" fill="#ffffff" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <!-- Header Icon & Label -->
          <g transform="translate(${x + 14}, ${y + 14}) scale(0.66)">
            ${getSvgIcon(iconName, 16, "#6366f1")}
          </g>
          <text x="${x + 36}" y="${y + 24}" font-family="Inter, -apple-system, sans-serif" font-size="11.5" font-weight="600" fill="#64748b">${escapeXml(m.label)}</text>
          <!-- Big KPI Value -->
          <text x="${x + 14}" y="${y + 62}" font-family="Inter, -apple-system, sans-serif" font-size="24" font-weight="800" fill="#0f172a">${escapeXml(m.value)}</text>
          <!-- Delta Pill Badge -->
          ${m.delta ? `
          <g transform="translate(${x + 14}, ${y + 78})">
            <rect x="0" y="0" width="${m.delta.length * 6.5 + 14}" height="18" rx="4" fill="${deltaBg}" />
            <text x="${(m.delta.length * 6.5 + 14) / 2}" y="12.5" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="10" font-weight="700" fill="${deltaColor}">${escapeXml(m.delta)}</text>
          </g>` : ""}
          <!-- Sparkline Curve -->
          <polyline points="${sparkPoints.join(" ")}" fill="none" stroke="${deltaColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </g>`
      );
      continue;
    }

    // ─── 3. Vector Dashboard Chart (`type: "chart"`) ─────────────────────────
    if (shape.type === "chart") {
      const c = shape as ChartShape;
      const chartType = c.chartType ?? "area";
      const padX = 24;
      const padTop = 60;
      const padBottom = 30;
      const innerW = w - padX * 2;
      const innerH = h - padTop - padBottom;

      const vals = c.data.map((d) => d.value);
      const maxVal = Math.max(...vals, 1);

      let chartBody = "";

      if (chartType === "area" || chartType === "line") {
        const coords = c.data.map((d, i) => ({
          x: x + padX + (i / (c.data.length - 1)) * innerW,
          y: y + padTop + innerH - (d.value / maxVal) * innerH,
        }));

        let linePath = `M ${coords[0].x} ${coords[0].y}`;
        for (let i = 1; i < coords.length; i++) {
          const cx = (coords[i - 1].x + coords[i].x) / 2;
          linePath += ` C ${cx} ${coords[i - 1].y}, ${cx} ${coords[i].y}, ${coords[i].x} ${coords[i].y}`;
        }

        const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${y + padTop + innerH} L ${coords[0].x} ${y + padTop + innerH} Z`;

        chartBody = `
          <!-- Area Gradient Fill -->
          <path d="${areaPath}" fill="url(#chart-area-grad)" />
          <!-- Smooth Spline Stroke -->
          <path d="${linePath}" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" />
          <!-- Data Points & Labels -->
          ${coords.map((p, idx) => `
            <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#ffffff" stroke="#6366f1" stroke-width="2" />
            <text x="${p.x}" y="${y + padTop + innerH + 16}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9.5" font-weight="600" fill="#94a3b8">${escapeXml(c.data[idx].label)}</text>
          `).join("")}
        `;
      } else if (chartType === "bar") {
        const barWidth = Math.max(12, (innerW / c.data.length) * 0.55);
        const gap = innerW / c.data.length;

        chartBody = c.data.map((d, i) => {
          const barH = (d.value / maxVal) * innerH;
          const bx = x + padX + i * gap + (gap - barWidth) / 2;
          const by = y + padTop + innerH - barH;
          const barColor = d.color ?? "#6366f1";
          return `
            <g>
              <rect x="${bx}" y="${by}" width="${barWidth}" height="${barH}" rx="4" fill="${barColor}" />
              <text x="${bx + barWidth / 2}" y="${by - 6}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="#475569">${d.value}</text>
              <text x="${bx + barWidth / 2}" y="${y + padTop + innerH + 16}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9.5" font-weight="600" fill="#94a3b8">${escapeXml(d.label)}</text>
            </g>
          `;
        }).join("");
      }

      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${c.cornerRadius ?? 10}" fill="#ffffff" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <!-- Chart Header -->
          <text x="${x + 16}" y="${y + 26}" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#0f172a">${escapeXml(c.title)}</text>
          ${c.subtitle ? `<text x="${x + 16}" y="${y + 44}" font-family="Inter, sans-serif" font-size="10.5" font-weight="500" fill="#64748b">${escapeXml(c.subtitle)}</text>` : ""}
          <!-- Grid Line -->
          <line x1="${x + padX}" y1="${y + padTop + innerH}" x2="${x + w - padX}" y2="${y + padTop + innerH}" stroke="#e2e8f0" stroke-width="1" />
          ${chartBody}
        </g>`
      );
      continue;
    }

    // ─── 4. Device / Browser Chrome Mockup (`type: "mockup"`) ─────────────────
    if (shape.type === "mockup") {
      const m = shape as MockupShape;
      const urlText = m.url ?? "https://app.drawstack.io/analytics";
      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <!-- Outer Shell -->
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${m.cornerRadius ?? 12}" fill="#ffffff" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <!-- Top Chrome Header -->
          <rect x="${x}" y="${y}" width="${w}" height="38" rx="${m.cornerRadius ?? 12}" fill="#f1f5f9" />
          <rect x="${x}" y="${y + 26}" width="${w}" height="12" fill="#f1f5f9" />
          <line x1="${x}" y1="${y + 38}" x2="${x + w}" y2="${y + 38}" stroke="#e2e8f0" stroke-width="1" />
          <!-- macOS Traffic Lights -->
          <circle cx="${x + 18}" cy="${y + 19}" r="5" fill="#ff5f56" />
          <circle cx="${x + 34}" cy="${y + 19}" r="5" fill="#ffbd2e" />
          <circle cx="${x + 50}" cy="${y + 19}" r="5" fill="#27c93f" />
          <!-- URL Pill Bar -->
          <rect x="${x + 72}" y="${y + 8}" width="${Math.min(w - 144, 280)}" height="22" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
          <text x="${x + 82}" y="${y + 23}" font-family="'JetBrains Mono', Inter, monospace" font-size="10" font-weight="500" fill="#64748b">${escapeXml(urlText)}</text>
        </g>`
      );
      continue;
    }

    // ─── 5. World-Class Architecture Card Shape (`type: "card"`) ──────────────
    if (shape.type === "card") {
      const card = shape as CardShape;
      const iconName = card.icon ?? "server";
      const iconColor = card.stroke ? resolveColor(card.stroke) ?? card.stroke : "#4f46e5";
      const badgeText = card.badge?.text ?? card.role ?? "";
      const badgeBg = card.badge?.bg ?? "#eef2ff";
      const badgeColor = card.badge?.color ?? "#4338ca";

      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${card.cornerRadius ?? 10}" fill="#ffffff" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <rect x="${x}" y="${y}" width="${w}" height="42" rx="${card.cornerRadius ?? 10}" fill="${fill === "none" ? "#f8fafc" : fill}" />
          <rect x="${x}" y="${y + 32}" width="${w}" height="10" fill="${fill === "none" ? "#f8fafc" : fill}" />
          <line x1="${x}" y1="${y + 42}" x2="${x + w}" y2="${y + 42}" stroke="#e2e8f0" stroke-width="1" />
          <g transform="translate(${x + 10}, ${y + 9})">
            <rect x="0" y="0" width="24" height="24" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
            <g transform="translate(4, 4) scale(0.66)">
              ${getSvgIcon(iconName, 16, iconColor)}
            </g>
          </g>
          <text x="${x + 40}" y="${y + 25}" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#0f172a">${escapeXml(card.title)}</text>
          ${badgeText ? `
          <g transform="translate(${x + w - 12}, ${y + 21})">
            <rect x="-${badgeText.length * 6 + 12}" y="-9" width="${badgeText.length * 6 + 12}" height="18" rx="4" fill="${badgeBg}" />
            <text x="-${(badgeText.length * 6 + 12) / 2}" y="3.5" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="9.5" font-weight="700" fill="${badgeColor}">${escapeXml(badgeText)}</text>
          </g>` : ""}
          ${card.subtitle ? `
          <text x="${x + 12}" y="${y + 60}" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="500" fill="#64748b">${escapeXml(card.subtitle)}</text>` : ""}
          ${(card.metadata ?? []).map((m, idx) => `
          <g transform="translate(${x + 12}, ${y + 78 + idx * 18})">
            <circle cx="3" cy="-3" r="2" fill="#94a3b8" />
            <text x="10" y="0" font-family="Inter, -apple-system, sans-serif" font-size="10.5" font-weight="600" fill="#475569">${escapeXml(m.label)}:</text>
            <text x="${12 + m.label.length * 6.5}" y="0" font-family="Inter, -apple-system, sans-serif" font-size="10.5" font-weight="500" fill="#0f172a">${escapeXml(m.value)}</text>
          </g>`).join("")}
        </g>`
      );
      continue;
    }

    // ─── 6. Database Schema / ERD Table Shape (`type: "table"`) ────────────────
    if (shape.type === "table") {
      const table = shape as TableShape;
      const headerBg = table.headerBg ? resolveColor(table.headerBg) ?? table.headerBg : "#f1f5f9";
      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${table.cornerRadius ?? 8}" fill="#ffffff" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <rect x="${x}" y="${y}" width="${w}" height="34" rx="${table.cornerRadius ?? 8}" fill="${headerBg}" />
          <rect x="${x}" y="${y + 24}" width="${w}" height="10" fill="${headerBg}" />
          <line x1="${x}" y1="${y + 34}" x2="${x + w}" y2="${y + 34}" stroke="#cbd5e1" stroke-width="1.2" />
          <g transform="translate(${x + 10}, ${y + 9}) scale(0.66)">
            ${getSvgIcon("database", 16, "#334155")}
          </g>
          <text x="${x + 30}" y="${y + 22}" font-family="'JetBrains Mono', Inter, monospace" font-size="12" font-weight="700" fill="#0f172a">${escapeXml(table.tableName)}</text>
          ${table.columns.map((col, idx) => {
            const rowY = y + 54 + idx * 22;
            const badge = col.isPk ? `<rect x="${x + 8}" y="${rowY - 10}" width="20" height="14" rx="3" fill="#fef3c7"/><text x="${x + 18}" y="${rowY}" text-anchor="middle" font-family="Inter, sans-serif" font-size="8.5" font-weight="800" fill="#b45309">PK</text>` : col.isFk ? `<rect x="${x + 8}" y="${rowY - 10}" width="20" height="14" rx="3" fill="#e0f2fe"/><text x="${x + 18}" y="${rowY}" text-anchor="middle" font-family="Inter, sans-serif" font-size="8.5" font-weight="800" fill="#0369a1">FK</text>` : `<circle cx="${x + 18}" cy="${rowY - 3}" r="2" fill="#cbd5e1"/>`;
            return `
            <g>
              ${badge}
              <text x="${x + 34}" y="${rowY}" font-family="'JetBrains Mono', Inter, monospace" font-size="11" font-weight="600" fill="#1e293b">${escapeXml(col.name)}</text>
              <text x="${x + w - 10}" y="${rowY}" text-anchor="end" font-family="'JetBrains Mono', Inter, monospace" font-size="10.5" font-weight="500" fill="#64748b">${escapeXml(col.type)}</text>
            </g>`;
          }).join("")}
        </g>`
      );
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
          <rect x="${x + 10}" y="${y - 12}" width="${Math.max(70, (shape.name?.length ?? 0) * 8 + 20)}" height="22" rx="5" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
          <text x="${x + 20}" y="${y + 3}" font-family="Inter, -apple-system, sans-serif" font-size="11.5" font-weight="700" fill="#334155">${escapeXml(shape.name ?? "")}</text>`
        );
        break;
      }
    }

    if (shape.text?.content) {
      const textColor = shape.text.color ?? (shape.type === "sticky" ? "#713f12" : "#0f172a");
      const fontSize = shape.text.fontSize ?? 13;
      const fontWeight = shape.text.bold ? "700" : "500";
      const align = shape.text.align ?? (shape.type === "text" ? "left" : "center");
      const textAnchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - 12 : x + 12;

      const lines = shape.text.content.split("\n");
      const lineHeight = fontSize * 1.35;
      const totalTextHeight = lines.length * lineHeight;
      const yOffset = shape.type === "cylinder" ? h * 0.1 : 0;
      const startY = y + yOffset + (h - yOffset) / 2 - totalTextHeight / 2 + fontSize * 0.85;

      const tspans = lines
        .map((line, idx) => `<tspan x="${tx}" y="${Math.round(startY + idx * lineHeight)}">${escapeXml(line)}</tspan>`)
        .join("");

      elements.push(
        `<text font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${textColor}" text-anchor="${textAnchor}">${tspans}</text>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}" style="background:#f8fafc;border-radius:12px;box-shadow:inset 0 0 0 1px #e2e8f0">
  ${defs}
  <pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1" fill="#cbd5e1" />
  </pattern>
  <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#dot-grid)" opacity="0.65" />
  ${elements.join("\n  ")}
</svg>`;
}
