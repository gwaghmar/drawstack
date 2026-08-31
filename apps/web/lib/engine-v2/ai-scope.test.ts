import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "./document";
import { applyAiScope } from "./ai-scope";

describe("engine-v2 AI scope", () => {
  it("edits only selected nodes and returns a transaction summary", () => {
    const current = structuredClone(ENGINE_V2_SAMPLE);
    const generated = structuredClone(current);
    const frame = generated.children[0];
    assert.equal(frame.type, "frame");
    if (frame.type !== "frame") return;
    const header = frame.children.find((node) => node.id === "header");
    assert.ok(header && header.type === "frame");
    if (!header || header.type !== "frame") return;
    const nested = header.children.find((node) => node.id === "title-stack");
    assert.ok(nested && nested.type === "frame");
    if (!nested || nested.type !== "frame") return;
    const text = nested.children[0];
    assert.equal(text.type, "text");
    if (text.type !== "text") return;
    text.content = "Updated";
    const result = applyAiScope(current, generated, "edit", [text.id]);
    assert.equal(result.document.children[0].id, current.children[0].id);
    assert.equal(result.summary.changedNodeIds.join(","), text.id);
    assert.ok(result.transaction.operations.length > 0);
    assert.equal(JSON.stringify(result.document.children[0]), JSON.stringify(generated.children[0]));
  });

  it("rejects an edit response that omits a selected id", () => {
    assert.throws(() => applyAiScope(ENGINE_V2_SAMPLE, structuredClone(ENGINE_V2_SAMPLE), "edit", ["missing"]), /Selected node ids/);
  });
});
