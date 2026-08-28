import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSharePreviewDataUrl, sanitizeSharePreviewDataUrl } from "./share-preview.ts";

describe("share preview data URLs", () => {
  it("accepts bounded raster previews", () => {
    const preview = "data:image/png;base64,iVBORw==";
    assert.equal(sanitizeSharePreviewDataUrl(preview), preview);
    assert.deepEqual(parseSharePreviewDataUrl(preview), { mime: "image/png", base64: "iVBORw==" });
    assert.ok(parseSharePreviewDataUrl("data:image/jpeg;base64,/9j/2Q=="));
    assert.ok(parseSharePreviewDataUrl("data:image/webp;base64,UklGRg=="));
  });

  it("rejects active SVG and unapproved image media types", () => {
    assert.equal(sanitizeSharePreviewDataUrl("data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pjwv c2NyaXB0Pjwvc3ZnPg=="), null);
    assert.equal(sanitizeSharePreviewDataUrl("data:image/gif;base64,R0lGODlh"), null);
  });

  it("rejects malformed and oversized payloads", () => {
    assert.equal(sanitizeSharePreviewDataUrl("data:image/png,not-base64"), null);
    assert.equal(sanitizeSharePreviewDataUrl("data:image/png;base64,%%%="), null);
    assert.equal(sanitizeSharePreviewDataUrl(`data:image/png;base64,${"A".repeat(400_000)}`), null);
  });
});
