import { expect, test } from "@playwright/test";

test("engine v2 exposes editable document structure", async ({ page }) => {
  await page.goto("/app/engine-v2");

  await expect(page.getByText("LIVE DOM", { exact: true })).toBeVisible();
  await expect(page.locator('[data-node-id="title"]')).toHaveText("Growth without the noise.");

  await page.getByLabel("TEXT CONTENT").fill("Growth, measured clearly.");
  await expect(page.locator('[data-node-id="title"]')).toHaveText("Growth, measured clearly.");

  await page.getByTitle("Undo").click();
  await expect(page.locator('[data-node-id="title"]')).toHaveText("Growth without the noise.");
  await page.getByTitle("Redo").click();
  await expect(page.locator('[data-node-id="title"]')).toHaveText("Growth, measured clearly.");

  await page.getByRole("button", { name: "FRAME Key metrics" }).click();
  await expect(page.getByText("id metrics", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Layout mode")).toHaveValue("grid");
  await expect(page.getByLabel("Gap")).toHaveValue("14");

  await page.getByRole("button", { name: "METRIC Monthly revenue" }).click();
  await page.getByTitle("Duplicate node").click();
  await expect(page.getByRole("button", { name: "METRIC Monthly revenue copy" })).toBeVisible();
  await page.getByTitle("Delete node").click();
  await expect(page.getByRole("button", { name: "METRIC Monthly revenue copy" })).toHaveCount(0);
});

test("engine v2 supports focus-safe keyboard editing", async ({ page }) => {
  await page.goto("/app/engine-v2");

  const revenue = page.locator('[data-tree-node-id="mrr"]');
  await revenue.focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(revenue).toBeFocused();
  const order = await page.locator("[data-tree-node-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-tree-node-id")));
  expect(order.indexOf("mrr")).toBeGreaterThan(order.indexOf("retention"));

  await page.keyboard.press("Control+d");
  const copy = page.locator('[data-tree-node-id="mrr-copy"]');
  await expect(copy).toBeFocused();
  await page.keyboard.press("Backspace");
  await expect(copy).toHaveCount(0);
  await expect(page.locator('[data-tree-node-id="metrics"]')).toBeFocused();

  await page.keyboard.press("Control+z");
  await expect(page.locator('[data-tree-node-id="mrr-copy"]')).toBeVisible();
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator('[data-tree-node-id="mrr-copy"]')).toHaveCount(0);

  await page.getByLabel("Describe what to build").focus();
  await page.keyboard.press("Control+d");
  await expect(page.locator('[data-tree-node-id="metrics-copy"]')).toHaveCount(0);
});

test("engine v2 resizes selected nodes without leaving document flow", async ({ page }) => {
  await page.goto("/app/engine-v2");

  const widthHandle = page.getByRole("button", { name: "Resize selected node width", exact: true });
  await expect(widthHandle).toBeVisible();
  const handleBounds = await widthHandle.boundingBox();
  expect(handleBounds).not.toBeNull();
  await page.mouse.move(handleBounds!.x + handleBounds!.width / 2, handleBounds!.y + handleBounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBounds!.x + handleBounds!.width / 2 + 70, handleBounds!.y + handleBounds!.height / 2);
  await page.mouse.up();

  const widthInput = page.getByRole("spinbutton", { name: "Node width", exact: true });
  await expect(widthInput).not.toHaveValue("");
  await page.getByTitle("Undo").click();
  await expect(widthInput).toHaveValue("");

  await widthInput.fill("420");
  await page.getByRole("spinbutton", { name: "Node minimum height", exact: true }).fill("180");
  const selectedNode = page.locator('[data-node-id="title"]');
  await expect(selectedNode).toHaveCSS("width", "420px");
  await expect(selectedNode).toHaveCSS("min-height", "180px");
  await expect(selectedNode).toHaveCSS("position", "static");
});
