import { expect, test, type Page } from "@playwright/test";

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("landing navigation targets the current product routes", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Pricing", exact: true }).first()).toHaveAttribute("href", "/pricing");
  await expect(page.getByRole("link", { name: "Docs", exact: true }).first()).toHaveAttribute("href", "/docs");
  await expect(page.getByRole("link", { name: "Templates", exact: true }).first()).toHaveAttribute("href", "/app/templates");
  await expect(page.getByRole("link", { name: /Open studio/ }).first()).toHaveAttribute("href", "/app/engine-v2");
  expect(errors).toEqual([]);
});

test("dashboard prompt reaches Engine v2 generation unchanged", async ({ page }) => {
  const errors = collectPageErrors(page);
  const requestedPrompt = "Create a quarterly revenue chart grouped by product";
  let generatedPrompt: string | undefined;
  let generationRequests = 0;

  await page.route("**/api/ai/engine-v2", async (route) => {
    generationRequests += 1;
    const request = route.request();
    const body = request.postDataJSON() as { prompt?: string; currentDocument: unknown };
    generatedPrompt = body.prompt;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ document: body.currentDocument }),
    });
  });

  await page.goto("/app");
  await page.getByPlaceholder(/Create a multilingual sales funnel/).fill(requestedPrompt);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/app/engine-v2"),
    page.getByRole("button", { name: "Create", exact: true }).click(),
  ]);

  const promptInput = page.getByLabel("Describe what to build");
  await expect(promptInput).toHaveValue(requestedPrompt);
  await expect.poll(() => generatedPrompt).toBe(requestedPrompt);
  await expect.poll(() => generationRequests).toBe(1);
  await page.waitForTimeout(300);
  expect(generationRequests).toBe(1);
  await expect(page.getByRole("button", { name: "Generate", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("mobile app menu exposes the main destinations without overflow", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await page.getByRole("button", { name: "Toggle menu" }).click();

  await expect(page.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute("href", "/app");
  await expect(page.getByRole("link", { name: "Studio", exact: true })).toHaveAttribute("href", "/app/engine-v2");
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveAttribute("href", "/app/settings");
  await expect(page.getByRole("link", { name: /New visual/ })).toHaveAttribute("href", "/app/engine-v2");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("templates use one shared app header", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/app/templates");

  await expect(page.locator("header")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute("href", "/app");
  await expect(page.getByRole("link", { name: "Studio", exact: true })).toHaveAttribute("href", "/app/engine-v2");
  await expect(page.getByRole("link", { name: /New visual/ })).toHaveAttribute("href", "/app/engine-v2");
  expect(errors).toEqual([]);
});

test("billing checkout failure is visible and retryable", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.route("**/api/billing/checkout", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "Billing is temporarily unavailable" }),
  }));
  await page.goto("/app/billing");

  const checkout = page.getByRole("button", { name: "Go to Stripe Checkout" });
  await checkout.click();
  await expect(page.getByText("Billing is temporarily unavailable", { exact: true })).toBeVisible();
  await expect(checkout).toBeEnabled();
  expect(errors).toEqual([]);
});

test("no-credit generation error exposes recovery actions", async ({ page }) => {
  await page.route("**/api/ai/engine-v2", (route) => route.fulfill({
    status: 402,
    contentType: "application/json",
    body: JSON.stringify({ error: "No credits left. Add your own AI key or upgrade." }),
  }));
  await page.goto("/app/engine-v2");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByText("No credits left. Add your own AI key or upgrade.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add AI key" })).toHaveAttribute("href", "/app/settings");
  await expect(page.getByRole("link", { name: "Upgrade" })).toHaveAttribute("href", "/app/billing");
});
