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

test("freeform: macro shape omitting width/height for auto-sizing is ok", async () => {
  // getShapeBounds() falls through to computeDynamicShapeDimensions() for any
  // shape missing width/height -- rejecting that here was a real production bug:
  // the AI commonly omits these on mindmap/dashboard/chart to let content drive
  // size, and every generation surface (demo, main generate, agent) shares this
  // validator, so this silently broke real generations, not just edge cases.
  const r = await validateAndRepairOutput(
    "freeform",
    '```json\n{"version":1,"shapes":[{"id":"m1","type":"mindmap","x":100,"y":100,"steps":[{"number":"01","title":"Sign Up","isTerminal":true}]}]}\n```'
  );
  assert.equal(r.ok, true);
});

test("freeform: shape with a contentless decorative text block is ok", async () => {
  // Reproduces a second live-production failure found immediately after the
  // width/height fix above: the AI attached a text style object (fontSize/
  // fontFamily/fill, no content) to a step_timeline shape. The renderer
  // guards with `shape.text?.content` and skips silently -- one shape's
  // harmless mistake was rejecting the entire document.
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({
      version: 1,
      shapes: [
        {
          id: "s1",
          type: "step_timeline",
          title: "Customer Onboarding",
          steps: [{ label: "STEP 1", title: "Sign Up", description: "Create an account." }],
          text: { wrap: true, fontSize: 14, fontFamily: "Inter, sans-serif" },
          x: 100,
          y: 50,
        },
      ],
    })
  );
  assert.equal(r.ok, true);
});

test("freeform: shape with text as a bare string is coerced, not rejected", async () => {
  // Reproduces a third live-production failure, found by curling the demo
  // endpoint directly until the exact case reappeared: the model commonly
  // emits `text: "some string"` on type:"text" shapes instead of the
  // documented `text: { content: "some string" }`. This is an obviously-
  // recoverable shorthand -- normalize it rather than reject the document.
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({
      version: 1,
      shapes: [
        { id: "title", type: "text", text: "90-Day Startup Launch Plan", fontSize: 48, x: 50, y: 50 },
      ],
    })
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    const doc = JSON.parse(r.source);
    assert.equal(doc.shapes[0].text.content, "90-Day Startup Launch Plan");
  }
});

test("freeform: arrow x/y survive validation instead of being stripped", async () => {
  // Caught while fixing the bare-string-text coercion above: switching the
  // function to return the validated (coerced) data instead of the raw
  // repaired string exposed that FreeformArrowShapeSchema/FreeformPathShapeSchema
  // had no .passthrough(), so Zod's default strip-unknown-keys behavior silently
  // dropped x/y (and anything else not explicitly listed) from every arrow and
  // path shape it validated. BaseShape requires x/y on every shape including
  // arrows -- this would have shipped arrows missing required fields.
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({
      version: 1,
      shapes: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        { id: "b", type: "rectangle", x: 100, y: 0, width: 10, height: 10 },
        { id: "ar", type: "arrow", x: 0, y: 0, start: { shapeId: "a", anchor: "auto" }, end: { shapeId: "b", anchor: "auto" } },
      ],
    })
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    const doc = JSON.parse(r.source);
    const arrow = doc.shapes.find((s: { id: string }) => s.id === "ar");
    assert.equal(arrow.x, 0);
    assert.equal(arrow.y, 0);
  }
});
