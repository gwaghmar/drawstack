import type { DiagramCategory, DiagramType } from "./diagram-types.js";
import { getDiagramTypeMeta } from "./diagram-types.js";

export interface FollowUpCandidate {
  text: string;
  /** Lowercase keywords — skip this suggestion if any already appear in the generated source */
  excludeIfSourceContains?: string[];
}

/**
 * Deterministic, authored follow-up suggestions — not model-generated.
 * Modeled on VS Code Copilot Chat's ChatFollowup pattern: canned candidates,
 * filtered against the actual output, rather than an LLM guessing blind
 * before the diagram exists.
 */
const FOLLOWUP_BY_CATEGORY: Record<DiagramCategory, FollowUpCandidate[]> = {
  whiteboard: [
    { text: "Add more detail" },
    { text: "Try a different color scheme" },
    { text: "Tidy up the layout" },
  ],
};

export function getFollowUpSuggestions(diagramType: DiagramType, finalSource: string, max = 3): string[] {
  const category = getDiagramTypeMeta(diagramType).category;
  const candidates = FOLLOWUP_BY_CATEGORY[category] ?? [];
  const lowerSource = finalSource.toLowerCase();
  return candidates
    .filter((c) => !c.excludeIfSourceContains?.some((kw) => lowerSource.includes(kw)))
    .map((c) => c.text)
    .slice(0, max);
}
