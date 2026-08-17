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

test("freeform: shape missing x/y is defaulted to origin, not rejected", async () => {
  // Fourth live-production failure, found by curling the demo endpoint with a
  // batch of fresh prompts: a layered_process_map came back with no x/y at
  // all. Unlike width/height, the render layer has no auto-position fallback
  // -- but defaulting to (0,0) beats losing the whole document; the shape is
  // visible and draggable rather than gone.
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({
      version: 1,
      shapes: [
        {
          id: "p1",
          type: "layered_process_map",
          title: "Onboarding",
          zones: [{ id: "z1", label: "Sales", color: "#3b82f6" }],
          nodes: [{ id: "n1", zoneId: "z1", label: "Discovery Call" }],
          connections: [],
        },
      ],
    })
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    const doc = JSON.parse(r.source);
    assert.equal(doc.shapes[0].x, 0);
    assert.equal(doc.shapes[0].y, 0);
  }
});

test("freeform: a truncated trailing shape is dropped, the rest of the document survives", async () => {
  // The most common real failure by far, found by generating ~15 fresh
  // documents against the real model and validating each: hitting
  // maxOutputTokens mid-object always truncates the LAST shape in the array
  // (confirmed on 3 separate live captures -- a text shape cut off after
  // "fill":, an arrow cut off before start/end, an arrow cut off mid-routing
  // value). The old whole-array validation threw away 10-20 perfectly valid
  // shapes over that one truncated straggler. Shapes are now validated one at
  // a time; only the shape(s) that fail are dropped.
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({
      version: 1,
      shapes: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        { id: "b", type: "rectangle", x: 100, y: 0, width: 10, height: 10 },
        // truncated mid-generation: arrow with no start/end at all
        { id: "trunc", name: "cut off arrow", type: "arrow" },
      ],
    })
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    const doc = JSON.parse(r.source);
    assert.equal(doc.shapes.length, 2);
    assert.deepEqual(doc.shapes.map((s: { id: string }) => s.id), ["a", "b"]);
  }
});

test("freeform: whole document still rejected when every shape is invalid", async () => {
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({ version: 1, shapes: [{ id: "trunc", type: "arrow" }] })
  );
  assert.equal(r.ok, false);
});

test("freeform: null-valued optional fields are stripped, not rejected", async () => {
  // Fifth live-production failure: the model emits `field: null` for an unset
  // optional field (fill, strokeDash confirmed live on two separate real
  // generations) instead of omitting the key. Zod's .optional() accepts
  // undefined, not null. Null and "not provided" mean the same thing here.
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({
      version: 1,
      shapes: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10, fill: null, strokeDash: null },
      ],
    })
  );
  assert.equal(r.ok, true);
});

test("freeform: dropping an invalid frame ungroups its children instead of failing the document", async () => {
  // Sixth live-production failure: a truncated/invalid frame shape gets
  // dropped by per-shape validation (test above), which used to orphan its
  // children's frameId and fail validateFreeformRefs on the whole document.
  // Children now survive, just ungrouped.
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({
      version: 1,
      shapes: [
        { id: "child1", type: "rectangle", x: 0, y: 0, width: 10, height: 10, frameId: "ghost_frame" },
        { id: "child2", type: "rectangle", x: 50, y: 0, width: 10, height: 10, frameId: "ghost_frame" },
      ],
    })
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    const doc = JSON.parse(r.source);
    assert.equal(doc.shapes.length, 2);
    assert.equal(doc.shapes[0].frameId, null);
  }
});

test("freeform: an arrow referencing a dropped/missing shape is dropped, not the whole document", async () => {
  const r = await validateAndRepairOutput(
    "freeform",
    JSON.stringify({
      version: 1,
      shapes: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        { id: "dangling", type: "arrow", x: 0, y: 0, start: { shapeId: "a", anchor: "auto" }, end: { shapeId: "ghost", anchor: "auto" } },
      ],
    })
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    const doc = JSON.parse(r.source);
    assert.equal(doc.shapes.length, 1);
    assert.equal(doc.shapes[0].id, "a");
  }
});
