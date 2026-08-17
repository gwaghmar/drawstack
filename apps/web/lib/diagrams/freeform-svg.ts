import {
  type CanvasDocument,
  type CanvasShape,
  type ArrowShape,
  type PathShape,
  type RectShape,
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

function computeSmartOrthogonalPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startAnchor?: string,
  endAnchor?: string
): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // Simple straight line if aligned
  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  // Anchor-aware routing
  if (startAnchor === "top" || startAnchor === "bottom") {
    const stubY = startAnchor === "top" ? start.y - Math.min(25, Math.abs(dy) / 2) : start.y + Math.min(25, Math.abs(dy) / 2);
    if (endAnchor === "left" || endAnchor === "right") {
      return `M ${start.x} ${start.y} L ${start.x} ${stubY} L ${start.x} ${end.y} L ${end.x} ${end.y}`;
    }
    const midX = Math.round((start.x + end.x) / 2);
    return `M ${start.x} ${start.y} L ${start.x} ${stubY} L ${midX} ${stubY} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  }

  if (startAnchor === "left" || startAnchor === "right") {
    const stubX = startAnchor === "left" ? start.x - Math.min(25, Math.abs(dx) / 2) : start.x + Math.min(25, Math.abs(dx) / 2);
    if (endAnchor === "top" || endAnchor === "bottom") {
      return `M ${start.x} ${start.y} L ${stubX} ${start.y} L ${end.x} ${start.y} L ${end.x} ${end.y}`;
    }
    const midX = Math.round((start.x + end.x) / 2);
    return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
  }

  // Default clean step
  const midX = Math.round((start.x + end.x) / 2);
  return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
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

  const padding = 50;
  const vx = Math.round(minX - padding);
  const vy = Math.round(minY - padding);
  const vw = Math.max(100, Math.round(maxX - minX + padding * 2));
  const vh = Math.max(100, Math.round(maxY - minY + padding * 2));

  const defs = `
  <defs>
    <!-- Soft Physical Drop Shadow -->
    <filter id="soft-shadow" x="-8%" y="-8%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.08" />
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#0f172a" flood-opacity="0.04" />
    </filter>
    <filter id="sticky-shadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="2" dy="4" stdDeviation="5" flood-color="#78350f" flood-opacity="0.12" />
    </filter>
    <!-- Markers -->
    <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#475569" />
    </marker>
    <marker id="arrowhead-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 9 1.5 L 0 5 L 9 8.5 z" fill="#475569" />
    </marker>
  </defs>`;

  const elements: string[] = [];

  for (const shape of doc.shapes) {
    const rawFill = shape.fill ? resolveColor(shape.fill) ?? shape.fill : shape.type === "sticky" ? "#fef08a" : "#ffffff";
    const fill = rawFill === "transparent" ? "none" : rawFill;
    const stroke = shape.stroke ? resolveColor(shape.stroke) ?? shape.stroke : shape.type === "frame" ? "#94a3b8" : "#334155";
    const strokeWidth = shape.strokeWidth ?? 2;
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

    // ─── Connectors (Arrows & Lines) ──────────────────────────────────────────
    if (shape.type === "arrow" || shape.type === "line") {
      const arrow = shape as ArrowShape;
      const { start, end } = resolveArrowRenderEndpoints(doc, arrow);
      const markerEnd = shape.type === "arrow" && arrow.arrowEnd !== false ? 'marker-end="url(#arrowhead)"' : "";
      const markerStart = shape.type === "arrow" && arrow.arrowStart ? 'marker-start="url(#arrowhead-start)"' : "";

      const startAnchor = isBoundEndpoint(arrow.start) ? arrow.start.anchor : undefined;
      const endAnchor = isBoundEndpoint(arrow.end) ? arrow.end.anchor : undefined;

      let pathD: string;
      if (arrow.routing === "orthogonal") {
        pathD = computeSmartOrthogonalPath(start, end, startAnchor, endAnchor);
      } else {
        pathD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      }

      elements.push(
        `<path d="${pathD}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${strokeDash} fill="none" ${markerStart} ${markerEnd} ${opacity} />`
      );

      if (arrow.label) {
        const midX = Math.round((start.x + end.x) / 2);
        const midY = Math.round((start.y + end.y) / 2);
        const labelWidth = Math.max(48, arrow.label.length * 7.5 + 16);
        elements.push(
          `<g transform="translate(${midX}, ${midY})">
            <rect x="-${labelWidth / 2}" y="-11" width="${labelWidth}" height="22" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2" opacity="0.95" filter="url(#soft-shadow)" />
            <text x="0" y="4" text-anchor="middle" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#334155">${escapeXml(arrow.label)}</text>
          </g>`
        );
      }
      continue;
    }

    const w = (shape as RectShape).width;
    const h = (shape as RectShape).height;
    const x = shape.x;
    const y = shape.y;
    const shadowFilter = shape.type === "sticky" ? 'filter="url(#sticky-shadow)"' : shape.type !== "frame" ? 'filter="url(#soft-shadow)"' : "";

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
            <!-- Cylinder Body Background -->
            <path d="M ${x} ${cyTop} L ${x} ${cyBottom} A ${w / 2} ${ry} 0 0 0 ${x + w} ${cyBottom} L ${x + w} ${cyTop} Z" fill="${fill}" stroke="none" />
            <!-- Cylinder Bottom Arch -->
            <path d="M ${x} ${cyBottom} A ${w / 2} ${ry} 0 0 0 ${x + w} ${cyBottom}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <!-- Cylinder Side Walls -->
            <line x1="${x}" y1="${cyTop}" x2="${x}" y2="${cyBottom}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <line x1="${x + w}" y1="${cyTop}" x2="${x + w}" y2="${cyBottom}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <!-- Cylinder Top Cap -->
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
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="6,4" ${opacity} />
          <rect x="${x + 8}" y="${y - 12}" width="${Math.max(60, (shape.name?.length ?? 0) * 8 + 16)}" height="20" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
          <text x="${x + 16}" y="${y + 2}" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#475569">${escapeXml(shape.name ?? "")}</text>`
        );
        break;
      }
    }

    // ─── Multiline Centered Text with <tspan> ──────────────────────────────────
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
      // Cylinder text offset to avoid top cap ellipse
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
  <!-- Canvas Grid Background -->
  <pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1" fill="#cbd5e1" />
  </pattern>
  <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="url(#dot-grid)" opacity="0.6" />
  ${elements.join("\n  ")}
</svg>`;
}
