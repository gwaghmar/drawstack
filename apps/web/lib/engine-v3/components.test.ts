import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AssetRef, EngineNode } from "./document.ts";
import { defineComponent, detachComponentInstance, instantiateComponent, registerAsset, sha256Hex, validateComponents } from "./components.ts";
const text = (id: string): EngineNode => ({ id, name: id, type: "text", content: id, variant: "body" });

describe("engine-v3 assets and components", () => {
  it("hashes and deduplicates identical asset content", async () => {
    const first = await registerAsset({}, "same", { mime: "text/plain" });
    const second = await registerAsset(first.assets, "same", { mime: "text/plain", source: "other" });
    assert.equal(first.asset.sha256, await sha256Hex("same"));
    assert.equal(second.created, false);
    assert.equal(Object.keys(second.assets).length, 1);
  });
  it("defines, instantiates with overrides, and detaches", () => {
    const defined = defineComponent({}, "card", "Card", text("root"));
    const instance = instantiateComponent({ components: defined.components }, "card", "instance", { content: "Updated" });
    assert.equal(instance.type === "text" ? instance.content : null, "Updated");
    assert.equal(instance.componentRef, "card");
    const detached = detachComponentInstance(instance);
    assert.equal(detached.componentRef, undefined);
    assert.equal(detached.type === "text" ? detached.content : null, "Updated");
  });
  it("rejects missing references and recursion", () => {
    assert.throws(() => validateComponents({ a: { id: "a", name: "A", root: { ...text("a-root"), componentRef: "missing" }, slots: [], variants: {} } }), /missing component/);
    assert.throws(() => validateComponents({ a: { id: "a", name: "A", root: { ...text("a-root"), componentRef: "b" }, slots: [], variants: {} }, b: { id: "b", name: "B", root: { ...text("b-root"), componentRef: "a" }, slots: [], variants: {} } }), /recursion/);
    const defined = defineComponent({}, "card", "Card", text("root"));
    assert.throws(() => instantiateComponent({ components: defined.components }, "card", "instance", { "__proto__.polluted": true }), /Invalid override path/);
  });
});
