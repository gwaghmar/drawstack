import assert from "node:assert/strict";
import test from "node:test";
import { safeLocalRedirect } from "./safe-redirect.ts";

test("accepts local application paths", () => {
  assert.equal(safeLocalRedirect("/app/engine-v2?welcome=1#canvas"), "/app/engine-v2?welcome=1#canvas");
});

test("rejects external and authority-form redirects", () => {
  for (const value of [
    "https://attacker.example",
    "//attacker.example/path",
    "/\\attacker.example/path",
    "https:%2f%2fattacker.example",
  ]) {
    assert.equal(safeLocalRedirect(value), "/app/editor");
  }
});
