import assert from "node:assert/strict";
import test from "node:test";
import { hasEngineV2VersionConflict, nextEngineV2UpdatedAt } from "./persistence.ts";

test("a save version always advances when two saves share a clock tick", () => {
  const current = new Date("2026-08-28T12:00:00.100Z");
  assert.equal(nextEngineV2UpdatedAt(current, current).toISOString(), "2026-08-28T12:00:00.101Z");
});

test("detects a stale editor version without treating the current version as stale", () => {
  const current = new Date("2026-08-28T12:00:02.000Z");
  assert.equal(hasEngineV2VersionConflict("2026-08-28T12:00:01.000Z", current), true);
  assert.equal(hasEngineV2VersionConflict(current.toISOString(), current), false);
});

test("a later database clock becomes the save version", () => {
  const current = new Date("2026-08-28T12:00:00.100Z");
  const now = new Date("2026-08-28T12:00:02.000Z");
  assert.equal(nextEngineV2UpdatedAt(current, now).toISOString(), now.toISOString());
});
