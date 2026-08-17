import { ALL_TEMPLATES as CORE_TEMPLATES, getTemplateSource } from "@flowchart/core";
import type { DiagramType } from "@flowchart/core";

export type TemplateCategory = "whiteboard";

export type Template = {
  id: string;
  title: string;
  description: string;
  diagramType: DiagramType;
  themeId: string;
  source: string;
  /** Tailwind gradient classes used for the card thumbnail when no preview exists. */
  gradient: string;
  /** Short use-case tag shown on the card. */
  tag: string;
  /** Filter category for the templates page filter bar. */
  category: TemplateCategory;
};

const GRADIENTS = [
  "from-indigo-500 via-purple-500 to-pink-500",
  "from-sky-500 via-blue-500 to-indigo-500",
  "from-emerald-500 via-teal-500 to-cyan-500",
  "from-amber-500 via-orange-500 to-rose-500",
  "from-fuchsia-500 via-violet-500 to-indigo-500",
];

/**
 * Curated starting points for the Free Canvas — sourced from the shared core
 * template list (`@flowchart/core`) so the editor's "New from type" default
 * and the templates gallery never drift apart.
 */
export const TEMPLATES: Template[] = CORE_TEMPLATES.map((t, i) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  diagramType: (t.diagramType ?? "freeform") as DiagramType,
  themeId: "stage_pipeline",
  source: getTemplateSource(t),
  gradient: GRADIENTS[i % GRADIENTS.length],
  tag: "Free Canvas",
  category: "whiteboard",
}));

export const ALL_TEMPLATES: Template[] = TEMPLATES;

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
