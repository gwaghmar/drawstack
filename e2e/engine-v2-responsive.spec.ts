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

test("engine v3 stays usable on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/engine-v2?mode=v3");
  await expect(page.getByRole("button", { name: "Open layers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Draw with pen" }).click();
  await expect(page.getByRole("button", { name: "Draw with pen" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Open inspector" }).click();
  await expect(page.getByRole("complementary", { name: "Inspector" })).toBeVisible();
  const surface = page.locator('[data-node-id="title"]');
  await expect.poll(async () => (await surface.boundingBox())?.width ?? 0).toBeGreaterThan(300);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("engine v3 pans the phone artboard with arrow keys", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/engine-v2?mode=v3");
  await page.getByRole("button", { name: "Deselect", exact: true }).click();
  const viewport = page.getByLabel("Editable canvas");
  await viewport.focus();
  const before = await viewport.evaluate((element) => element.scrollLeft);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
});
