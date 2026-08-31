import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { demoSignIn } from "./helpers";

const COMPLEX_FLOW = JSON.stringify({
  version: 1,
  shapes: [
    { id: "users", name: "users", type: "rectangle", x: 80, y: 140, width: 160, height: 70, text: { content: "Users" } },
    { id: "gateway", name: "gateway", type: "rectangle", x: 330, y: 140, width: 180, height: 70, text: { content: "API Gateway" } },
    { id: "service", name: "service", type: "rectangle", x: 600, y: 70, width: 180, height: 70, text: { content: "Order Service" } },
    { id: "database", name: "database", type: "cylinder", x: 600, y: 230, width: 180, height: 90, text: { content: "Postgres" } },
    { id: "a1", type: "arrow", x: 0, y: 0, start: { shapeId: "users", anchor: "auto" }, end: { shapeId: "gateway", anchor: "auto" }, routing: "orthogonal" },
    { id: "a2", type: "arrow", x: 0, y: 0, start: { shapeId: "gateway", anchor: "auto" }, end: { shapeId: "service", anchor: "auto" }, routing: "orthogonal" },
    { id: "a3", type: "arrow", x: 0, y: 0, start: { shapeId: "service", anchor: "auto" }, end: { shapeId: "database", anchor: "auto" }, routing: "orthogonal" },
  ],
});

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

test.describe("Stress and quality checks", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("handles a complex technical canvas with presentation switches", async ({
    page,
  }) => {
    await demoSignIn(page, `stress1-${Date.now()}@example.com`);

    await page.goto("/app/editor");
    await expect(page).toHaveURL(/\/app\/editor/);

    await openSourcePanel(page);
    const source = page.locator("pre.hl-pre + textarea");
    await source.fill(COMPLEX_FLOW);
    await expect(page.getByRole("alert").filter({ hasText: /Invalid canvas JSON/i })).toHaveCount(0);

    await page.getByTitle("Switch to dark mode").click();
    await page.getByTitle("Switch to light mode").click();

    await openExportMenu(page);
    const pngD = page.waitForEvent("download");
    await page.getByRole("button", { name: "PNG" }).click();
    expect((await pngD).suggestedFilename()).toContain(".png");

    await openExportMenu(page);
    const svgD = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG" }).click();
    expect((await svgD).suggestedFilename()).toContain(".svg");
  });

  test("recovers from dumb/broken code quickly and keeps UI responsive", async ({ page }) => {
    await demoSignIn(page, `stress2-${Date.now()}@example.com`);

    await page.goto("/app/editor");
    await expect(page).toHaveURL(/\/app\/editor/);

    await openSourcePanel(page);
    const source = page.locator("pre.hl-pre + textarea");
    await source.fill("not valid json {{{");
    await expect(page.getByRole("alert").filter({ hasText: /Invalid canvas JSON/i })).toBeVisible();

    await page.goto("/app/editor?template=distributed_microservices");
    await expect(page.getByRole("alert").filter({ hasText: /Invalid canvas JSON/i })).toHaveCount(0);

    await expect(page.getByText(/Saved|Unsaved/).first()).toBeVisible();
  });
});
