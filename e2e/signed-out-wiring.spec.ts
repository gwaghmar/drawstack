import { expect, test } from "@playwright/test";

const signedOutBaseUrl = process.env.SIGNED_OUT_BASE_URL;

test("signed-out Engine v2 routes preserve their login callback", async ({ page }) => {
  test.skip(!signedOutBaseUrl, "Set SIGNED_OUT_BASE_URL to a server running with MOCK_AUTH=false");

  for (const route of [
    "/app/engine-v2",
    "/app/engine-v2?id=saved-project",
    "/app/engine-v2?prompt=Create%20a%20revenue%20chart",
    "/app/engine-v2?id=saved-project&prompt=Update%20the%20revenue%20chart",
  ]) {
    await page.goto(`${signedOutBaseUrl}${route}`);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("callbackUrl")).toBe(route);
  }
});
