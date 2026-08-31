import assert from "node:assert/strict";
import test from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { EngineV3HistoryController } from "./history.ts";

test("batches are one undo step and redo is invalidated by a new edit", () => {
  const doc = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  const pageId = doc.pages[0].id;
  const history = new EngineV3HistoryController(doc);
  history.apply({ kind: "batch", commands: [
    { kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "A" } },
    { kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "B" } },
  ]}, "local", "test", "batch");
  assert.equal(history.snapshot().canUndo, true);
  history.undo();
  assert.deepEqual({ canUndo: history.snapshot().canUndo, canRedo: history.snapshot().canRedo }, { canUndo: false, canRedo: true });
  history.redo();
  assert.deepEqual({ canUndo: history.snapshot().canUndo, canRedo: history.snapshot().canRedo }, { canUndo: true, canRedo: false });
  history.undo();
  history.apply({ kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "C" } });
  assert.equal(history.snapshot().canRedo, false);
});

test("rejects stale application without changing history", () => {
  const doc = migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE)).document;
  const history = new EngineV3HistoryController(doc, 4);
  const pageId = doc.pages[0].id;
  assert.throws(() => history.apply({ kind: "node", action: "patch", pageId, nodeId: "title", changes: { name: "X" }, precondition: { revision: 3 } }));
  assert.equal(history.snapshot().revision, 4);
  assert.equal(history.snapshot().canUndo, false);
});
