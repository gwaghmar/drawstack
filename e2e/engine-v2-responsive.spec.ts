import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "tablet", width: 932, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const) {
  test(`engine v2 exposes responsive editing drawers on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/app/engine-v2");

    const layersButton = page.getByRole("button", { name: "Open layers" });
    const inspectButton = page.getByRole("button", { name: "Open inspector" });
    await expect(layersButton).toBeVisible();
    await expect(inspectButton).toBeVisible();

    await layersButton.click();
    const layers = page.locator('[data-engine-drawer="layers"]');
    await expect(layers).toBeVisible();
    await expect(layers.getByRole("button", { name: "FRAME Report" })).toBeVisible();
    await expect(layers.getByRole("button", { name: "Close layers" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(layers).toBeHidden();
    await expect(layersButton).toBeFocused();

    await inspectButton.click();
    const inspector = page.locator('[data-engine-drawer="inspect"]');
    await expect(inspector).toBeVisible();
    await expect(inspector.getByLabel("TEXT CONTENT")).toBeVisible();
    await inspector.getByRole("button", { name: "Close inspector" }).click();
    await expect(inspector).toBeHidden();
    await expect(inspectButton).toBeFocused();

    await expect(page.locator("[data-engine-toolbar]")).toBeVisible();
    await expect(page.getByText("Export", { exact: true })).toBeVisible();
    if (viewport.name === "phone") await expect(page.getByText("Swipe tools sideways for more", { exact: false })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
