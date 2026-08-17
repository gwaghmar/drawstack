import {
  type CanvasDocument,
  type CanvasShape,
  type ArrowShape,
  type PathShape,
  type RectShape,
  resolveArrowRenderEndpoints,
  getShapeBounds,
  resolveColor,
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

  const padding = 40;
  const vx = Math.round(minX - padding);
  const vy = Math.round(minY - padding);
  const vw = Math.max(100, Math.round(maxX - minX + padding * 2));
  const vh = Math.max(100, Math.round(maxY - minY + padding * 2));

  const defs = `
  <defs>
    <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
    </marker>
    <marker id="arrowhead-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 10 1 L 0 5 L 10 9 z" fill="#64748b" />
    </marker>
  </defs>`;

  const elements: string[] = [];

  for (const shape of doc.shapes) {
    const rawFill = shape.fill ? resolveColor(shape.fill) ?? shape.fill : shape.type === "sticky" ? "#fef08a" : "#ffffff";
    const fill = rawFill === "transparent" ? "none" : rawFill;
    const stroke = shape.stroke ? resolveColor(shape.stroke) ?? shape.stroke : shape.type === "frame" ? "#94a3b8" : "#1e293b";
    const strokeWidth = shape.strokeWidth ?? 2;
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

      let pathD: string;
      if (arrow.routing === "orthogonal") {
        const midX = Math.round((start.x + end.x) / 2);
        pathD = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
      } else {
        pathD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      }

      elements.push(
        `<path d="${pathD}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} fill="none" ${markerStart} ${markerEnd} ${opacity} />`
      );

      if (arrow.label) {
        const midX = Math.round((start.x + end.x) / 2);
        const midY = Math.round((start.y + end.y) / 2);
        elements.push(
          `<g transform="translate(${midX}, ${midY})">
            <rect x="-${Math.max(20, arrow.label.length * 4)}" y="-10" width="${Math.max(40, arrow.label.length * 8)}" height="20" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" opacity="0.9" />
            <text x="0" y="4" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" fill="#475569">${escapeXml(arrow.label)}</text>
          </g>`
        );
      }
      continue;
    }

    const w = (shape as RectShape).width;
    const h = (shape as RectShape).height;
    const x = shape.x;
    const y = shape.y;

    switch (shape.type) {
      case "rectangle":
      case "sticky": {
        const rx = shape.type === "sticky" ? 4 : (shape as RectShape).cornerRadius ?? 4;
        elements.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${opacity} />`
        );
        break;
      }
      case "diamond": {
        const pts = `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`;
        elements.push(
          `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${opacity} />`
        );
        break;
      }
      case "triangle": {
        const pts = `${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`;
        elements.push(
          `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${opacity} />`
        );
        break;
      }
      case "cylinder": {
        const ry = h * 0.15;
        const cyTop = y + ry;
        const cyBottom = y + h - ry;
        elements.push(
          `<g ${opacity}>
            <rect x="${x}" y="${cyTop}" width="${w}" height="${h - ry * 2}" fill="${fill}" stroke="none" />
            <line x1="${x}" y1="${cyTop}" x2="${x}" y2="${cyBottom}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <line x1="${x + w}" y1="${cyTop}" x2="${x + w}" y2="${cyBottom}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <ellipse cx="${x + w / 2}" cy="${cyBottom}" rx="${w / 2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
            <ellipse cx="${x + w / 2}" cy="${cyTop}" rx="${w / 2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
          </g>`
        );
        break;
      }
      case "cloud": {
        const pathData = `M ${x + w * 0.25} ${y + h * 0.75} C ${x + w * 0.05} ${y + h * 0.75} ${x + w * 0.05} ${y + h * 0.35} ${x + w * 0.3} ${y + h * 0.35} C ${x + w * 0.35} ${y + h * 0.1} ${x + w * 0.65} ${y + h * 0.1} ${x + w * 0.7} ${y + h * 0.35} C ${x + w * 0.95} ${y + h * 0.35} ${x + w * 0.95} ${y + h * 0.75} ${x + w * 0.75} ${y + h * 0.75} Z`;
        elements.push(
          `<path d="${pathData}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${opacity} />`
        );
        break;
      }
      case "hexagon": {
        const pts = `${x + w * 0.25},${y} ${x + w * 0.75},${y} ${x + w},${y + h * 0.5} ${x + w * 0.75},${y + h} ${x + w * 0.25},${y + h} ${x},${y + h * 0.5}`;
        elements.push(
          `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${opacity} />`
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
          `<polygon points="${starPoints.join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${opacity} />`
        );
        break;
      }
      case "ellipse": {
        elements.push(
          `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} ${opacity} />`
        );
        break;
      }
      case "frame": {
        elements.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="6,4" ${opacity} />
          <text x="${x + 6}" y="${y - 6}" font-family="Inter, sans-serif" font-size="12" fill="#64748b">${escapeXml(shape.name ?? "")}</text>`
        );
        break;
      }
    }

    if (shape.text?.content) {
      const textColor = shape.text.color ?? (shape.type === "sticky" ? "#713f12" : "#1e293b");
      const fontSize = shape.text.fontSize ?? 13;
      const fontWeight = shape.text.bold ? "bold" : "normal";
      const align = shape.text.align ?? (shape.type === "text" ? "left" : "center");
      const textAnchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - 10 : x + 10;
      const ty = y + h / 2 + fontSize * 0.35;

      elements.push(
        `<text x="${tx}" y="${ty}" text-anchor="${textAnchor}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${textColor}">${escapeXml(shape.text.content)}</text>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}" style="background:#ffffff">
  ${defs}
  ${elements.join("\n  ")}
</svg>`;
}
