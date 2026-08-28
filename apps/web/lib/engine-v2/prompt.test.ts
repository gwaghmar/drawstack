import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEngineV2Prompt } from "./prompt.ts";

test("normalizes starter prompts and bounds URL input", () => {
  assert.equal(normalizeEngineV2Prompt("  Build a revenue dashboard  "), "Build a revenue dashboard");
  assert.equal(normalizeEngineV2Prompt(" "), undefined);
  assert.equal(normalizeEngineV2Prompt("x".repeat(1200))?.length, 1000);
});
