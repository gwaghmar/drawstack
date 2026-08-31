import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAssetStorage, createMemoryAssetStorage } from "./asset-storage.ts";

const input = { content: '<svg><rect width="2"/></svg>', mime: "image/svg+xml", source: "test" };

describe("engine-v3 asset storage", () => {
  it("isolates owners and deduplicates content", async () => {
    const storage = createMemoryAssetStorage();
    const first = await storage.put(input, "alice");
    const second = await storage.put(input, "alice");
    assert.equal(second.created, false);
    assert.equal((await storage.list("alice")).length, 1);
    assert.equal((await storage.list("bob")).length, 0);
    assert.equal((await storage.get("alice", first.asset.sha256))?.content.byteLength, input.content.length);
    assert.equal(await storage.delete("alice", first.asset.sha256), true);
  });
  it("persists sanitized SVG bytes, not the uploaded source", async () => {
    const storage = createMemoryAssetStorage();
    const stored = await storage.put({ ...input, content: '<!DOCTYPE svg><!-- note --><svg><rect width="2"/></svg>' }, "alice");
    const result = await storage.get("alice", stored.asset.sha256);
    assert.equal(new TextDecoder().decode(result?.content), '<svg><rect width="2"/></svg>');
  });
  it("reports honest unavailable state without external storage", async () => {
    const storage = createAssetStorage();
    assert.deepEqual(storage.status, { available: false, mode: "unavailable", reason: "External asset storage is not configured" });
    await assert.rejects(() => storage.put(input, "alice"), /unavailable/);
  });
  it("uses an external adapter with owner-scoped keys", async () => {
    const blobs = new Map<string, Uint8Array>();
    const storage = createAssetStorage({ async put(key, content) { blobs.set(key, content); }, async get(key) { return blobs.get(key) ?? null; }, async delete(key) { blobs.delete(key); } });
    const result = await storage.put(input, "alice");
    assert.ok(blobs.has("alice/" + result.asset.sha256));
    assert.equal((await storage.get("alice", result.asset.sha256))?.asset.ownerId, "alice");
    assert.equal(await storage.delete("alice", result.asset.sha256), true);
  });
});
