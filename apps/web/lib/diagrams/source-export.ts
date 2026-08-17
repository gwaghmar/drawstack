import type { DiagramType } from "@flowchart/core";

export function sourceFileExtension(_type: DiagramType): string {
  return "json";
}

function slugify(title: string): string {
  const s = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "diagram";
}

export function downloadSource(source: string, type: DiagramType, title: string): void {
  const ext = sourceFileExtension(type);
  const blob = new Blob([source], { type: ext === "json" ? "application/json" : "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(title)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
