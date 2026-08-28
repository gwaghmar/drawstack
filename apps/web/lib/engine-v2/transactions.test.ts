import assert from "node:assert/strict";
import test from "node:test";
import { ENGINE_V2_SAMPLE, mapNode } from "./document.ts";
import { applyEngineDocumentTransaction, createEngineDocumentTransaction } from "./transactions.ts";

test("round trips a document edit through normalized operations", () => {
  const after = {
    ...ENGINE_V2_SAMPLE,
    children: mapNode(ENGINE_V2_SAMPLE.children, "title", (node) => node.type === "text" ? { ...node, content: "Updated title" } : node),
  };
  const transaction = createEngineDocumentTransaction(ENGINE_V2_SAMPLE, after, "local", "tx-1");

  assert.deepEqual(applyEngineDocumentTransaction(ENGINE_V2_SAMPLE, transaction), after);
  assert.deepEqual(transaction.operations.map((operation) => operation.type), ["patch-node"]);
});

test("transactions for separate properties on one node merge", () => {
  const contentEdit = {
    ...ENGINE_V2_SAMPLE,
    children: mapNode(ENGINE_V2_SAMPLE.children, "title", (node) => node.type === "text" ? { ...node, content: "Shared title" } : node),
  };
  const nameEdit = {
    ...ENGINE_V2_SAMPLE,
    children: mapNode(ENGINE_V2_SAMPLE.children, "title", (node) => ({ ...node, name: "Hero title" })),
  };
  const contentTransaction = createEngineDocumentTransaction(ENGINE_V2_SAMPLE, contentEdit, "local", "tx-content");
  const nameTransaction = createEngineDocumentTransaction(ENGINE_V2_SAMPLE, nameEdit, "local", "tx-name");

  const merged = applyEngineDocumentTransaction(
    applyEngineDocumentTransaction(ENGINE_V2_SAMPLE, contentTransaction),
    nameTransaction,
  );
  const root = merged.children[0];
  const header = root.type === "frame" && root.children[0]?.type === "frame" ? root.children[0] : null;
  const titleStack = header?.children[0]?.type === "frame" ? header.children[0] : null;
  const title = titleStack?.children[1];
  assert.equal(title?.name, "Hero title");
  assert.equal(title?.type === "text" ? title.content : null, "Shared title");
});

test("transactions for separate nodes merge without replacing either edit", () => {
  const titleEdit = {
    ...ENGINE_V2_SAMPLE,
    children: mapNode(ENGINE_V2_SAMPLE.children, "title", (node) => node.type === "text" ? { ...node, content: "Shared title" } : node),
  };
  const metricEdit = {
    ...ENGINE_V2_SAMPLE,
    children: mapNode(ENGINE_V2_SAMPLE.children, "mrr", (node) => node.type === "metric" ? { ...node, value: "$500K" } : node),
  };
  const titleTransaction = createEngineDocumentTransaction(ENGINE_V2_SAMPLE, titleEdit, "local", "tx-title");
  const metricTransaction = createEngineDocumentTransaction(ENGINE_V2_SAMPLE, metricEdit, "local", "tx-metric");

  const merged = applyEngineDocumentTransaction(
    applyEngineDocumentTransaction(ENGINE_V2_SAMPLE, titleTransaction),
    metricTransaction,
  );
  const root = merged.children[0];
  assert.equal(root.type, "frame");
  const titleStack = root.children[0]?.type === "frame" ? root.children[0].children[0] : null;
  const metrics = root.children[1]?.type === "frame" ? root.children[1].children[0] : null;
  assert.equal(titleStack?.type === "frame" ? titleStack.children[1]?.type === "text" && titleStack.children[1].content : null, "Shared title");
  assert.equal(metrics?.type === "metric" ? metrics.value : null, "$500K");
});

test("child ordering is a separate operation from node content", () => {
  const root = ENGINE_V2_SAMPLE.children[0];
  assert.equal(root.type, "frame");
  const after = {
    ...ENGINE_V2_SAMPLE,
    children: [{ ...root, children: [root.children[1], root.children[0], ...root.children.slice(2)] }],
  };
  const transaction = createEngineDocumentTransaction(ENGINE_V2_SAMPLE, after, "local", "tx-order");

  assert.deepEqual(transaction.operations.map((operation) => operation.type), ["set-child-order"]);
  assert.deepEqual(applyEngineDocumentTransaction(ENGINE_V2_SAMPLE, transaction), after);
});
