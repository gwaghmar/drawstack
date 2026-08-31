import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { demoSignIn } from "./helpers";

async function openSourcePanel(page: Page) {
  const sourceToggle = page.getByTitle("Toggle Source editor");
  await expect(sourceToggle).toBeVisible();
  const sourceArea = page.locator("pre.hl-pre + textarea");
  if (!(await sourceArea.isVisible().catch(() => false))) await sourceToggle.click();
  await expect(sourceArea).toBeVisible();
}

async function openExportMenu(page: Page) {
  const exportRoot = page.locator("[data-export-menu-root]").first();
  const exportBtn = exportRoot.getByRole("button", { name: "Export" });
  await expect(exportBtn).toBeVisible();
  const expanded = await exportBtn.getAttribute("aria-expanded");
  if (expanded !== "true") {
    await exportBtn.click();
  }
  await expect(exportBtn).toHaveAttribute("aria-expanded", "true");
  await expect(exportRoot.getByRole("button", { name: "PNG" })).toBeVisible();
}

test.describe("Rigorous browser flow", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test("login -> create -> edit -> invalid input recovery -> export -> share", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://localhost:3040",
    });
    await demoSignIn(page, `rigorous-${Date.now()}@example.com`);

    await page.goto("/app/editor?template=stage_pipeline_azure_style");
    await expect(page).toHaveURL(/\/app\/editor/);

    await expect(page.getByPlaceholder("How should I change the diagram?")).toBeVisible();

    await openSourcePanel(page);
    const sourceArea = page.locator("pre.hl-pre + textarea");
    await sourceArea.fill("not valid json {{{");
    await expect(page.getByRole("alert").filter({ hasText: /Invalid canvas JSON/i })).toBeVisible();

    await page.goto("/app/editor?template=decision_tree");
    await expect(page).toHaveURL(/\/app\/editor/);
    await expect(page.getByRole("alert").filter({ hasText: /Invalid canvas JSON/i })).toHaveCount(0);

    await page.getByTitle("Switch to dark mode").click();
    await page.getByTitle("Switch to light mode").click();

    await page
      .getByPlaceholder("How should I change the diagram?")
      .fill(
        "Generate a complex microservices deployment flow with retries and observability",
      );
    const [aiResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/ai/generate")),
      page.getByPlaceholder("How should I change the diagram?").press("Enter"),
    ]);
    if (aiResp.ok()) {
      await expect(page.getByRole("alert").filter({ hasText: /Invalid canvas JSON/i })).toHaveCount(0);
    } else {
      await expect(
        page
          .locator(".border-red-200.bg-red-50")
          .filter({ hasText: /No API key|No credits left|Upstream AI|Model returned|AI request failed/i }),
      ).toBeVisible();
    }

    await expect(page.getByText(/Saved|Unsaved/).first()).toBeVisible();

    await openExportMenu(page);
    const pngDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "PNG" }).click();
    const png = await pngDownload;
    expect(png.suggestedFilename().endsWith(".png")).toBeTruthy();

    await openExportMenu(page);
    const svgDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG" }).click();
    const svg = await svgDownload;
    expect(svg.suggestedFilename().endsWith(".svg")).toBeTruthy();

    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByText(/Share link copied/)).toBeVisible();
  });

  test("settings API key and development plan controls work", async ({ page }) => {
    await demoSignIn(page, `rigorous2-${Date.now()}@example.com`);

    await page.goto("/app/settings");
    await page.getByPlaceholder("Key name").fill("E2E Key");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/newKey=fc_/);

    await page.getByRole("button", { name: "Set Pro" }).click();
    await expect(page).toHaveURL(/\/app\/settings/);
    await expect(page.getByRole("button", { name: "Set Free" })).toBeVisible();
  });

  test("billing page loads with checkout disabled", async ({ page }) => {
    await demoSignIn(page, `billing-${Date.now()}@example.com`);
    await page.goto("/app/billing");
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Paid plans are coming soon" })).toBeVisible();
    await expect(page.getByText("Not available", { exact: true })).toBeVisible();
  });

  test("mock developer admin can open /app/admin", async ({ page }) => {
    await demoSignIn(page, "dev@example.com");
    await page.goto("/app/admin");
    await expect(page).toHaveURL(/\/app\/admin/);
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("settings does not expose provider credentials", async ({ page }) => {
    await demoSignIn(page, `hosted-ai-${Date.now()}@example.com`);
    await page.goto("/app/settings");
    await expect(page.getByRole("heading", { level: 2, name: "REST API keys" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /AI Provider/ })).toHaveCount(0);
  });

  test("public marketing routes respond", async ({ page }) => {
    for (const path of ["/", "/pricing", "/docs", "/legal/privacy", "/legal/terms"]) {
      const res = await page.goto(path);
      expect(res?.ok()).toBeTruthy();
    }
  });
});
