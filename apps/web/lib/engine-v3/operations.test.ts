import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "../engine-v2/document.ts";
import { migrateV2ToV3 } from "./migration.ts";
import { addPage, duplicatePage, removePage, reorderPage, removeToken, setToken } from "./operations.ts";

const base = () => migrateV2ToV3(structuredClone(ENGINE_V2_SAMPLE), "2026-08-31T00:00:00.000Z").document;

describe("engine v3 page and token operations", () => {
  it("manages pages and falls back to the nearest page on removal", () => {
    const doc = base();
    const second = { ...doc.pages[0], id: "page-2", name: "Second" };
    const added = addPage(doc, second, 1, doc.pages[0].id);
    assert.deepEqual(added.document.pages.map((page) => page.id), [doc.pages[0].id, "page-2"]);
    const reordered = reorderPage(added.document, "page-2", 0);
    assert.equal(reordered.pages[0].id, "page-2");
    const removed = removePage(reordered, "page-2", "page-2");
    assert.equal(removed.activePageId, doc.pages[0].id);
  });

  it("duplicates a page with fresh node IDs", () => {
    const doc = base();
    const duplicate = duplicatePage(doc, doc.pages[0].id, "page-copy");
    assert.equal(duplicate.pages.length, 2);
    assert.notEqual(duplicate.pages[0].root.id, duplicate.pages[1].root.id);
  });

  it("sets aliases and rejects cycles or dangling references", () => {
    let doc = base();
    doc = setToken(doc, "colors", "brand", { value: "#123456" });
    doc = setToken(doc, "colors", "accent", { value: "#fff", alias: "brand" });
    assert.equal(doc.tokens.colors.accent.alias, "brand");
    assert.throws(() => setToken(doc, "colors", "brand", { value: "#123", alias: "accent" }), /cycle/);
    assert.throws(() => setToken(doc, "colors", "missing", { value: "#123", alias: "unknown" }), /not found/);
    assert.throws(() => removeToken(doc, "colors", "brand"), /referenced/);
    doc = removeToken(doc, "colors", "accent");
    assert.equal(doc.tokens.colors.accent, undefined);
  });
});
