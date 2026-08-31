import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_ASSET_BYTES, ingestAsset, sanitizeSvg } from "./asset-ingestion.ts";

describe("engine-v3 asset ingestion", () => {
  it("creates a content-addressed asset and safe preview", async () => {
    const result = await ingestAsset({ content: '<svg><rect width="10" height="10"/></svg>', mime: "image/svg+xml", source: "upload", license: "CC0", width: 10, height: 10 });
    assert.match(result.asset.sha256, /^[a-f0-9]{64}$/);
    assert.equal(result.asset.source, "upload");
    assert.equal(result.asset.license, "CC0");
    assert.match(result.previewSource, /^data:image\/svg\+xml;base64,/);
  });
  it("rejects unsupported, oversized, and dangerous content", async () => {
    await assert.rejects(() => ingestAsset({ content: "x", mime: "text/html", source: "x" }), /MIME/);
    await assert.rejects(() => ingestAsset({ content: new Uint8Array(MAX_ASSET_BYTES + 1), mime: "image/png", source: "x" }), /size/);
    assert.throws(() => sanitizeSvg("<svg><script>alert(1)</script></svg>"), /executable/);
    assert.doesNotMatch(sanitizeSvg('<svg><image href="https://evil.test/a.png"/></svg>'), /evil\\.test/);
  });
  it("removes harmless SVG metadata and doctype", () => {
    const clean = sanitizeSvg('<!DOCTYPE svg><!-- note --><svg><rect width="2"/></svg>');
    assert.equal(clean, '<svg><rect width="2"/></svg>');
  });
});
