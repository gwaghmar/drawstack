import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchTemplateId, TEMPLATE_KEYWORDS } from "./template-match.ts";
import { TEMPLATES } from "./templates.ts";

describe("matchTemplateId", () => {
  it("returns null when nothing matches", () => {
    assert.equal(matchTemplateId("draw me a cat playing piano"), null);
  });

  it("matches each template by a representative prompt", () => {
    const cases: Record<string, string> = {
      freeform_org_chart: "an org chart of our reporting structure",
      freeform_user_journey: "map the new user onboarding journey",
      freeform_cloud_microservices: "a microservice architecture with an api gateway",
      freeform_sprint_kanban: "a kanban sprint board with a backlog",
      freeform_decision_logic_tree: "a decision tree with yes no branching",
    };
    for (const [id, prompt] of Object.entries(cases)) {
      assert.equal(matchTemplateId(prompt), id, `prompt "${prompt}" should match ${id}`);
    }
  });

  it("favors specific multi-word matches over generic single words", () => {
    assert.equal(matchTemplateId("a user journey map for signups"), "freeform_user_journey");
    assert.equal(matchTemplateId("a sprint board kanban for the team"), "freeform_sprint_kanban");
  });

  it("is case-insensitive", () => {
    assert.equal(matchTemplateId("KANBAN Sprint BOARD"), "freeform_sprint_kanban");
  });

  it("every keyword entry points at a real template id", () => {
    const ids = new Set(TEMPLATES.map((t) => t.id));
    for (const { id } of TEMPLATE_KEYWORDS) {
      assert.ok(ids.has(id), `keyword entry "${id}" has no matching template`);
    }
  });
});
