import { type CanvasDocument, resolveColor } from "./freeform-canvas";

export function exportFreeformToReact(doc: CanvasDocument): string {
  const shapesCode = doc.shapes
    .map((shape) => {
      if (shape.type === "arrow" || shape.type === "line" || shape.type === "path") {
        return null;
      }

      const w = "width" in shape ? (shape as any).width : 100;
      const h = "height" in shape ? (shape as any).height : 100;

      const fillRaw = shape.fill && shape.fill !== "transparent" ? resolveColor(shape.fill) ?? shape.fill : "transparent";
      const bgStyle = fillRaw === "transparent" ? "bg-transparent" : `bg-[${fillRaw}]`;
      
      const strokeRaw = shape.stroke && shape.stroke !== "transparent" ? resolveColor(shape.stroke) ?? shape.stroke : "transparent";
      const borderStyle = strokeRaw === "transparent" ? "" : `border-2 border-[${strokeRaw}]`;

      let radius = "rounded-md";
      if (shape.type === "ellipse") radius = "rounded-full";
      if (shape.type === "card" || shape.type === "table" || shape.type === "image" || shape.type === "frame") radius = "rounded-xl";
      if (shape.type === "text") radius = "rounded-none border-none";

      const textStr = shape.text?.content ? shape.text.content : "";
      const textStyle = shape.text?.bold ? "font-bold" : "font-medium";
      const textColor = shape.text?.color ? `text-[${shape.text.color}]` : "text-slate-800";
      const align = shape.text?.align === "center" ? "justify-center text-center" : shape.text?.align === "right" ? "justify-end text-right" : "justify-start text-left";

      const isFrame = shape.type === "frame";
      const shadow = isFrame ? "" : "shadow-sm";
      const padding = isFrame ? "p-4" : "p-2";

      // Try to parse out the navigation link
      let clickHandler = "";
      if (shape.onClickNavigateToFrameId) {
        clickHandler = ` onClick={() => alert('Navigate to Frame: ${shape.onClickNavigateToFrameId}')} className="cursor-pointer hover:opacity-80 transition-opacity"`;
      }

      return `      {/* Shape: ${shape.type} (${shape.id}) */}
      <div 
        className="absolute ${bgStyle} ${borderStyle} ${radius} ${shadow} ${padding} flex items-center ${align} overflow-hidden"
        style={{ left: ${shape.x}, top: ${shape.y}, width: ${w}, height: ${h} }}${clickHandler}
      >
        ${textStr ? `<span className="text-sm ${textStyle} ${textColor}">${textStr.replace(/\n/g, '<br />')}</span>` : ""}
      </div>`;
    })
    .filter(Boolean)
    .join("\n\n");

  return `import React from 'react';

export default function ExportedPrototype() {
  return (
    <div className="relative w-full min-h-screen bg-slate-50 overflow-auto font-sans">
${shapesCode}
    </div>
  );
}
`;
}
