import assert from "node:assert/strict";
import test from "node:test";
import { ENGINE_V2_SAMPLE } from "./document.ts";
import {
  applyEngineV2AgentTransaction,
  exportEngineV2Document,
  inspectEngineV2Document,
} from "./agent-tools.ts";

test("inspects a validated document and addresses a nested node by id or name", () => {
  const byId = inspectEngineV2Document(ENGINE_V2_SAMPLE, { nodeId: "title" });
  assert.equal(byId.ok, true);
  if (!byId.ok) return;
  assert.equal(byId.selectedNode?.id, "title");
  assert.ok(byId.nodes.some((node) => node.id === "title" && node.depth > 0 && node.parentId));

  const byName = inspectEngineV2Document(ENGINE_V2_SAMPLE, { nodeName: byId.selectedNode!.name });
  assert.equal(byName.ok, true);
  if (byName.ok) assert.equal(byName.selectedNode?.id, "title");
});

test("reports invalid documents and missing inspection targets", () => {
  const invalid = inspectEngineV2Document({ version: 2 });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.ok(invalid.issues?.length);

  const missing = inspectEngineV2Document(ENGINE_V2_SAMPLE, { nodeId: "missing" });
  assert.deepEqual(missing, { ok: false, error: "Node not found: missing" });
});

test("applies a transaction and validates the resulting document", () => {
  const result = applyEngineV2AgentTransaction(ENGINE_V2_SAMPLE, {
    id: "agent-edit",
    origin: "ai",
    operations: [{ type: "patch-node", nodeId: "title", changes: { content: "Agent-authored title" }, unset: [] }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const inspection = inspectEngineV2Document(result.document, { nodeId: "title" });
  assert.equal(inspection.ok, true);
  if (inspection.ok) assert.equal(inspection.selectedNode?.type === "text" ? inspection.selectedNode.content : null, "Agent-authored title");

  const rejected = applyEngineV2AgentTransaction(ENGINE_V2_SAMPLE, {
    id: "invalid-edit",
    origin: "ai",
    operations: [{ type: "patch-node", nodeId: "title", changes: { variant: "invalid" }, unset: [] }],
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.match(rejected.error, /Transaction produced/);
});

test("exports validated documents through every supported agent format", () => {
  for (const format of ["json", "svg", "html", "tsx"] as const) {
    const result = exportEngineV2Document(ENGINE_V2_SAMPLE, format);
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.ok(result.payload.contents.length > 0);
    assert.ok(result.payload.filename.endsWith(`.${format}`));
  }

  const invalid = exportEngineV2Document(null, "json");
  assert.equal(invalid.ok, false);
});
