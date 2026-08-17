export const TEMPLATE_KEYWORDS: { id: string; keywords: string[] }[] = [
  { id: "freeform_org_chart",          keywords: ["org chart", "orgchart", "reporting structure", "reporting hierarchy", "who reports to", "team structure", "org structure"] },
  { id: "freeform_user_journey",       keywords: ["user journey", "journey map", "onboarding", "signup", "sign up", "activation", "user flow", "new user", "funnel"] },
  { id: "freeform_cloud_microservices", keywords: ["architecture", "system design", "microservice", "infrastructure", "backend", "aws", "cloud architecture", "cloud diagram", "api gateway", "deployment diagram"] },
  { id: "freeform_sprint_kanban",      keywords: ["kanban", "sprint board", "backlog", "sprint", "task board", "to do doing done", "scrum board"] },
  { id: "freeform_decision_logic_tree", keywords: ["decision tree", "logic tree", "flowchart", "branching", "if else", "decision flow", "yes no"] },
];

/**
 * Pick the template whose keywords best match the prompt. Each matched keyword
 * scores by its word count, so specific multi-word phrases ("sign in") outweigh
 * generic single words ("auth"). Ties resolve to the earlier template in the list.
 */
export function matchTemplateId(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  let bestId: string | null = null;
  let bestScore = 0;
  for (const { id, keywords } of TEMPLATE_KEYWORDS) {
    let score = 0;
    for (const k of keywords) {
      if (lower.includes(k)) score += k.split(" ").length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}
