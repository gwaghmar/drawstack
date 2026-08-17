import {
  type CanvasDocument,
  type CanvasShape,
  type ArrowShape,
  type PathShape,
  type RectShape,
  type CardShape,
  type TableShape,
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

// ─── SVG Vector Icons Library ───────────────────────────────────────────────
export function getSvgIcon(iconName: string, size = 16, color = "#6366f1"): string {
  const norm = iconName.toLowerCase().replace(/[^a-z0-9-]/g, "");
  switch (norm) {
    case "database":
    case "db":
    case "postgres":
    case "redis":
    case "sql":
      return `<path d="M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "server":
    case "service":
    case "node":
    case "backend":
      return `<rect x="2" y="3" width="20" height="7" rx="2" fill="none" stroke="${color}" stroke-width="2"/><rect x="2" y="14" width="20" height="7" rx="2" fill="none" stroke="${color}" stroke-width="2"/><line x1="6" y1="6.5" x2="6.01" y2="6.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="17.5" x2="6.01" y2="17.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
    case "cloud":
    case "aws":
    case "gcp":
    case "azure":
    case "saas":
      return `<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "shield":
    case "auth":
    case "security":
    case "jwt":
      return `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "lock":
      return `<rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="none" stroke="${color}" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="${color}" stroke-width="2"/>`;
    case "cpu":
    case "processor":
    case "engine":
      return `<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="${color}" stroke-width="2"/><rect x="9" y="9" width="6" height="6" fill="none" stroke="${color}" stroke-width="1.5"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
    case "queue":
    case "kafka":
    case "rabbitmq":
    case "stream":
      return `<path d="m22 7-9-5-9 5 9 5 9-5ZM2 17l9 5 9-5M2 12l9 5 9-5" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "api":
    case "code":
    case "gateway":
      return `<polyline points="16 18 22 12 16 6" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8 6 2 12 8 18" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "globe":
    case "web":
    case "cdn":
      return `<circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="2"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="${color}" stroke-width="2"/>`;
    case "credit-card":
    case "stripe":
    case "billing":
    case "bank":
      return `<rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="${color}" stroke-width="2"/><line x1="2" y1="10" x2="22" y2="10" stroke="${color}" stroke-width="2"/>`;
    case "activity":
    case "analytics":
    case "metrics":
      return `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "users":
    case "crm":
    case "team":
      return `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="none" stroke="${color}" stroke-width="2"/><circle cx="9" cy="7" r="4" fill="none" stroke="${color}" stroke-width="2"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="${color}" stroke-width="2"/>`;
    default:
      // Modern spark / diamond star icon
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

  // Convert waypoints to rounded bezier path
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
    <!-- Figma / Linear Style Multi-layer Soft Physical Drop Shadows -->
    <filter id="soft-card-shadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.08" />
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.04" />
    </filter>
    <filter id="pill-shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.06" />
    </filter>
    <!-- Arrow Markers -->
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

    // ─── Connectors (Arrows & Lines) with Smooth Fillet Rounded Turns ─────────
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

    // ─── 1. World-Class Architecture Card Shape (`type: "card"`) ──────────────
    if (shape.type === "card") {
      const card = shape as CardShape;
      const iconName = card.icon ?? "server";
      const iconColor = card.stroke ? resolveColor(card.stroke) ?? card.stroke : "#4f46e5";
      const badgeText = card.badge?.text ?? card.role ?? "";
      const badgeBg = card.badge?.bg ?? "#eef2ff";
      const badgeColor = card.badge?.color ?? "#4338ca";

      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <!-- Card Container -->
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${card.cornerRadius ?? 10}" fill="#ffffff" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <!-- Header Area -->
          <rect x="${x}" y="${y}" width="${w}" height="42" rx="${card.cornerRadius ?? 10}" fill="${fill === "none" ? "#f8fafc" : fill}" />
          <rect x="${x}" y="${y + 32}" width="${w}" height="10" fill="${fill === "none" ? "#f8fafc" : fill}" />
          <line x1="${x}" y1="${y + 42}" x2="${x + w}" y2="${y + 42}" stroke="#e2e8f0" stroke-width="1" />
          <!-- Header Icon Circle -->
          <g transform="translate(${x + 10}, ${y + 9})">
            <rect x="0" y="0" width="24" height="24" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
            <g transform="translate(4, 4) scale(0.66)">
              ${getSvgIcon(iconName, 16, iconColor)}
            </g>
          </g>
          <!-- Card Title -->
          <text x="${x + 40}" y="${y + 25}" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#0f172a">${escapeXml(card.title)}</text>
          <!-- Category Badge Pill -->
          ${badgeText ? `
          <g transform="translate(${x + w - 12}, ${y + 21})">
            <rect x="-${badgeText.length * 6 + 12}" y="-9" width="${badgeText.length * 6 + 12}" height="18" rx="4" fill="${badgeBg}" />
            <text x="-${(badgeText.length * 6 + 12) / 2}" y="3.5" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="9.5" font-weight="700" fill="${badgeColor}">${escapeXml(badgeText)}</text>
          </g>` : ""}
          <!-- Card Subtitle -->
          ${card.subtitle ? `
          <text x="${x + 12}" y="${y + 60}" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="500" fill="#64748b">${escapeXml(card.subtitle)}</text>` : ""}
          <!-- Metadata Rows -->
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

    // ─── 2. Database Schema / ERD Table Shape (`type: "table"`) ────────────────
    if (shape.type === "table") {
      const table = shape as TableShape;
      const headerBg = table.headerBg ? resolveColor(table.headerBg) ?? table.headerBg : "#f1f5f9";
      elements.push(
        `<g ${shadowFilter} ${opacity}>
          <!-- Table Shell -->
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${table.cornerRadius ?? 8}" fill="#ffffff" stroke="${stroke}" stroke-width="${strokeWidth}" />
          <!-- Header Bar -->
          <rect x="${x}" y="${y}" width="${w}" height="34" rx="${table.cornerRadius ?? 8}" fill="${headerBg}" />
          <rect x="${x}" y="${y + 24}" width="${w}" height="10" fill="${headerBg}" />
          <line x1="${x}" y1="${y + 34}" x2="${x + w}" y2="${y + 34}" stroke="#cbd5e1" stroke-width="1.2" />
          <!-- Table Header Title -->
          <g transform="translate(${x + 10}, ${y + 9}) scale(0.66)">
            ${getSvgIcon("database", 16, "#334155")}
          </g>
          <text x="${x + 30}" y="${y + 22}" font-family="'JetBrains Mono', Inter, monospace" font-size="12" font-weight="700" fill="#0f172a">${escapeXml(table.tableName)}</text>
          <!-- Table Columns -->
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

    // ─── Multiline Text Layout ────────────────────────────────────────────────
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
  <!-- Figma Canvas Subtle Dot Grid -->
  <pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1" fill="#cbd5e1" />
  </pattern>
  <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#dot-grid)" opacity="0.65" />
  ${elements.join("\n  ")}
</svg>`;
}
