import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { revisionIdsBeyondLimit } from "./revision-retention.ts";

describe("revisionIdsBeyondLimit", () => {
  it("keeps the ordered prefix and prunes exact ids after it", () => {
    const rows = [{ id: "new" }, { id: "same-time-a" }, { id: "same-time-b" }, { id: "old" }];
    assert.deepEqual(revisionIdsBeyondLimit(rows, 2), ["same-time-b", "old"]);
  });

  it("returns no ids below the limit and rejects invalid limits", () => {
    assert.deepEqual(revisionIdsBeyondLimit([{ id: "only" }], 2), []);
    assert.throws(() => revisionIdsBeyondLimit([], -1), RangeError);
  });
});
