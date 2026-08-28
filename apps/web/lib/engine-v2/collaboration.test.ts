import assert from "node:assert/strict";
import test from "node:test";
import { ENGINE_V2_SAMPLE, mapNode } from "./document.ts";
import { findEngineTransactionConflict, type EngineEditCursor, type EngineTransactionRecord } from "./collaboration.ts";
import { applyEngineDocumentTransaction, createEngineDocumentTransaction } from "./transactions.ts";

const baseCursor: EngineEditCursor = { createdAt: "2026-08-28T12:00:00.000Z", id: "base" };

function record(clientId: string, cursor: EngineEditCursor, transaction: ReturnType<typeof createEngineDocumentTransaction>): EngineTransactionRecord {
  return { clientId, cursor, baseCursor, transaction, userId: clientId };
}

test("two clients merge edits to different properties of the same node", () => {
  const contentDocument = { ...ENGINE_V2_SAMPLE, children: mapNode(ENGINE_V2_SAMPLE.children, "title", (node) => node.type === "text" ? { ...node, content: "Client A" } : node) };
  const nameDocument = { ...ENGINE_V2_SAMPLE, children: mapNode(ENGINE_V2_SAMPLE.children, "title", (node) => ({ ...node, name: "Client B title" })) };
  const a = record("a", { createdAt: "2026-08-28T12:00:01.000Z", id: "a" }, createEngineDocumentTransaction(ENGINE_V2_SAMPLE, contentDocument, "local", "a"));
  const b = record("b", { createdAt: "2026-08-28T12:00:01.000Z", id: "b" }, createEngineDocumentTransaction(ENGINE_V2_SAMPLE, nameDocument, "local", "b"));

  const merged = applyEngineDocumentTransaction(applyEngineDocumentTransaction(ENGINE_V2_SAMPLE, a.transaction), b.transaction);
  const root = merged.children[0];
  const header = root.type === "frame" && root.children[0]?.type === "frame" ? root.children[0] : null;
  const titleStack = header?.children[0]?.type === "frame" ? header.children[0] : null;
  const title = titleStack?.children[1];
  assert.equal(title?.type === "text" ? title.content : null, "Client A");
  assert.equal(title?.name, "Client B title");
  assert.equal(findEngineTransactionConflict(a, b), null);
});

test("two clients surface concurrent writes to the same field", () => {
  const documentA = { ...ENGINE_V2_SAMPLE, children: mapNode(ENGINE_V2_SAMPLE.children, "title", (node) => node.type === "text" ? { ...node, content: "Client A" } : node) };
  const documentB = { ...ENGINE_V2_SAMPLE, children: mapNode(ENGINE_V2_SAMPLE.children, "title", (node) => node.type === "text" ? { ...node, content: "Client B" } : node) };
  const a = record("a", { createdAt: "2026-08-28T12:00:01.000Z", id: "a" }, createEngineDocumentTransaction(ENGINE_V2_SAMPLE, documentA, "local", "a"));
  const b = record("b", { createdAt: "2026-08-28T12:00:01.000Z", id: "b" }, createEngineDocumentTransaction(ENGINE_V2_SAMPLE, documentB, "local", "b"));

  assert.deepEqual(findEngineTransactionConflict(a, b)?.keys, ["node:title:content"]);
  const serverOrdered = applyEngineDocumentTransaction(applyEngineDocumentTransaction(ENGINE_V2_SAMPLE, a.transaction), b.transaction);
  const root = serverOrdered.children[0];
  const header = root.type === "frame" && root.children[0]?.type === "frame" ? root.children[0] : null;
  const titleStack = header?.children[0]?.type === "frame" ? header.children[0] : null;
  const title = titleStack?.children[1];
  assert.equal(title?.type === "text" ? title.content : null, "Client B");
});

test("a later edit based on the first client is not a concurrency conflict", () => {
  const firstDocument = { ...ENGINE_V2_SAMPLE, children: mapNode(ENGINE_V2_SAMPLE.children, "title", (node) => node.type === "text" ? { ...node, content: "First" } : node) };
  const secondDocument = { ...ENGINE_V2_SAMPLE, children: mapNode(ENGINE_V2_SAMPLE.children, "title", (node) => node.type === "text" ? { ...node, content: "Second" } : node) };
  const first = record("a", { createdAt: "2026-08-28T12:00:01.000Z", id: "a" }, createEngineDocumentTransaction(ENGINE_V2_SAMPLE, firstDocument, "local", "a"));
  const second = {
    ...record("b", { createdAt: "2026-08-28T12:00:02.000Z", id: "b" }, createEngineDocumentTransaction(firstDocument, secondDocument, "local", "b")),
    baseCursor: first.cursor,
  };
  assert.equal(findEngineTransactionConflict(first, second), null);
});
