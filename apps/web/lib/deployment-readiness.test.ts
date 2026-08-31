import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDeploymentReadiness } from "./deployment-readiness.ts";

describe("getDeploymentReadiness", () => {
  it("marks production core config ready when required values are present", () => {
    const report = getDeploymentReadiness({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://example",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      AUTH_SECRET: "secret",
      OPENAI_API_KEY: "hosted-key",
      MOCK_AUTH: "false",
      MOCK_DB: "false",
    });

    assert.equal(report.ready, true);
    assert.equal(report.items.every((item) => item.status === "ready"), true);
  });

  it("flags missing production database and Supabase config", () => {
    const report = getDeploymentReadiness({
      NODE_ENV: "production",
    });

    assert.equal(report.ready, false);
    assert.deepEqual(
      report.items
        .filter((item) => item.status === "missing")
        .map((item) => item.id),
      [
        "database-url",
        "supabase-url",
        "supabase-anon-key",
        "auth-secret",
        "hosted-ai",
      ],
    );
  });

  it("blocks production mock auth and mock DB", () => {
    const report = getDeploymentReadiness({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://example",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      AUTH_SECRET: "secret",
      OPENAI_API_KEY: "hosted-key",
      MOCK_AUTH: "true",
      MOCK_DB: "true",
    });

    assert.equal(report.ready, false);
    assert.deepEqual(
      report.items
        .filter((item) => item.status === "blocked")
        .map((item) => item.id),
      ["mock-auth", "mock-db"],
    );
  });

  it("requires complete Stripe configuration only when billing is enabled", () => {
    const base = {
      DATABASE_URL: "postgresql://example",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      AUTH_SECRET: "secret",
      OPENAI_API_KEY: "hosted-key",
      MOCK_AUTH: "false",
      MOCK_DB: "false",
    };
    assert.equal(getDeploymentReadiness(base).ready, true);

    const incomplete = getDeploymentReadiness({ ...base, STRIPE_ENABLED: "true" });
    assert.equal(incomplete.ready, false);
    assert.deepEqual(
      incomplete.items.filter((item) => item.status === "missing").map((item) => item.id),
      ["stripe-secret", "stripe-webhook", "stripe-prices"],
    );

    const complete = getDeploymentReadiness({
      ...base,
      STRIPE_ENABLED: "true",
      STRIPE_SECRET_KEY: "secret",
      STRIPE_WEBHOOK_SECRET: "webhook",
      STRIPE_PRICE_PRO_MONTHLY: "monthly",
      STRIPE_PRICE_PRO_ANNUAL: "annual",
    });
    assert.equal(complete.ready, true);
  });
});
