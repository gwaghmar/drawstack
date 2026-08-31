import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { isStripeBillingEnabled } from "./billing-config.ts";

const original = process.env.STRIPE_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.STRIPE_ENABLED;
  else process.env.STRIPE_ENABLED = original;
});

describe("isStripeBillingEnabled", () => {
  it("is disabled by default", () => {
    delete process.env.STRIPE_ENABLED;
    assert.equal(isStripeBillingEnabled(), false);
  });

  it("requires an explicit true value", () => {
    for (const value of ["false", "1", "TRUE", "yes"]) {
      process.env.STRIPE_ENABLED = value;
      assert.equal(isStripeBillingEnabled(), false);
    }
    process.env.STRIPE_ENABLED = "true";
    assert.equal(isStripeBillingEnabled(), true);
  });
});
