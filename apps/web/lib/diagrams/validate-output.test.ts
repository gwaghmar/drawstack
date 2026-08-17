import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAndRepairOutput, parsePossiblyBrokenJson } from "./validate-output.ts";

test("freeform: valid executive dashboard and metrics is ok", async () => {
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({
      version: 1,
      shapes: [
        { id: "d1", type: "dashboard", title: "Metrics", x: 0, y: 0, width: 800, height: 400 },
        { id: "m1", type: "metric", label: "ARR", value: "$10M", x: 20, y: 80, width: 200, height: 100 },
        { id: "c1", type: "chart", title: "Revenue", chartType: "grouped_bar", x: 240, y: 80, width: 400, height: 200 },
      ],
    })
  );
  assert.equal(r.ok, true);
});

test("freeform: strips markdown fences the model wraps output in", async () => {
  const r = await validateAndRepairOutput(
    "freeform",
    '```json\n{"version":1,"shapes":[{"id":"a","type":"rectangle","x":0,"y":0,"width":10,"height":10}]}\n```'
  );
  assert.equal(r.ok, true);
});

test("freeform: repairs trailing commas rather than failing", async () => {
  const r = await validateAndRepairOutput(
    "freeform",
    '{"version":1,"shapes":[{"id":"a","type":"rectangle","x":0,"y":0,"width":10,"height":10},]}'
  );
  assert.equal(r.ok, true);
});

test("freeform: arrow bound to a missing shape is rejected", async () => {
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({
      version: 1,
      shapes: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        { id: "ar", type: "arrow", start: { shapeId: "a", anchor: "auto" }, end: { shapeId: "ghost", anchor: "auto" } },
      ],
    })
  );
  assert.equal(r.ok, false);
});

test("freeform: non-JSON is not ok", async () => {
  const r = await validateAndRepairOutput("freeform", "flowchart LR\n  A --> B");
  assert.equal(r.ok, false);
});

test("freeform: empty string is not ok", async () => {
  const r = await validateAndRepairOutput("freeform", "");
  assert.equal(r.ok, false);
});

test("freeform: missing shapes array is not ok", async () => {
  const r = await validateAndRepairOutput("freeform", JSON.stringify({ version: 1 }));
  assert.equal(r.ok, false);
});

test("parsePossiblyBrokenJson returns null on empty input", () => {
  assert.equal(parsePossiblyBrokenJson(""), null);
});
