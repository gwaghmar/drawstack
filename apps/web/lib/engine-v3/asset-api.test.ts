import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deleteAsset, getAsset, listAssets, uploadAsset } from "./asset-api.ts";
import { createMemoryAssetStorage, createAssetStorage } from "./asset-storage.ts";

const file = () => new File(['<svg><image href="https://evil.test/a.png"/></svg>'], "unsafe.svg", { type: "image/svg+xml" });
describe("engine-v3 asset API responses", () => {
  it("rejects invalid files and reports unavailable storage", async () => {
    const storage = createMemoryAssetStorage();
    let request = new Request("http://local", { method: "POST", body: new FormData() });
    assert.equal((await uploadAsset(storage, "a", request)).status, 400);
    assert.equal((await uploadAsset(createAssetStorage(), "a", request)).status, 503);
    assert.equal((await listAssets(createAssetStorage(), "a")).status, 503);
    assert.equal((await getAsset(createAssetStorage(), "a", "a".repeat(64))).status, 503);
    assert.equal((await deleteAsset(createAssetStorage(), "a", "a".repeat(64))).status, 503);
  });
  it("uploads sanitized content, isolates owners, lists, and deletes", async () => {
    const storage = createMemoryAssetStorage();
    const form = new FormData(); form.set("file", file()); form.set("license", "MIT");
    const result = await uploadAsset(storage, "alice", new Request("http://local", { method: "POST", body: form }));
    assert.equal(result.status, 201);
    const body = await result.json();
    assert.equal((await listAssets(storage, "bob")).status, 200);
    const stored = await storage.get("alice", body.asset.sha256);
    assert.ok(stored); assert.doesNotMatch(new TextDecoder().decode(stored.content), /script/);
    const downloaded = await getAsset(storage, "alice", body.asset.sha256);
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get("content-type"), "image/svg+xml");
    assert.equal((await deleteAsset(storage, "bob", body.asset.sha256)).status, 404);
    assert.equal((await deleteAsset(storage, "alice", body.asset.sha256)).status, 200);
  });
});
