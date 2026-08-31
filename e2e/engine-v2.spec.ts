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

  await page.getByRole("button", { name: "Open AI composer" }).click();
  await page.getByLabel("Describe what to build").focus();
  await page.keyboard.press("Control+d");
  await expect(page.locator('[data-tree-node-id="metrics-copy"]')).toHaveCount(0);
});

test("engine v2 groups a field editing burst into one undo step", async ({ page }) => {
  await page.goto("/app/engine-v2");

  const content = page.getByLabel("Text content", { exact: true });
  await content.fill("");
  await content.pressSequentially("One grouped edit", { delay: 20 });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-node-id="title"]')).toHaveText("Growth without the noise.");
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

  const widthInput = page.getByRole("textbox", { name: "Node width", exact: true });
  await expect(widthInput).not.toHaveValue("");
  await page.getByTitle("Undo").click();
  await expect(widthInput).toHaveValue("");

  await widthInput.fill("420");
  await page.getByRole("spinbutton", { name: "Node minimum height", exact: true }).fill("180");
  const selectedNode = page.locator('[data-node-id="title"]');
  await expect(selectedNode).toHaveCSS("width", "420px");
  await expect(selectedNode).toHaveCSS("min-height", "180px");
  await expect(selectedNode).toHaveCSS("position", "static");

  await widthInput.fill("50%");
  await expect(selectedNode).toHaveAttribute("style", /width: 50%/);
});

test("engine v2 multi-selects and edits sibling nodes in layout flow", async ({ page }) => {
  await page.goto("/app/engine-v2");

  await page.locator('[data-tree-node-id="mrr"]').click();
  await page.locator('[data-tree-node-id="retention"]').click({ modifiers: ["Shift"] });
  await expect(page.getByText("2 nodes selected", { exact: true })).toBeVisible();
  await expect(page.locator("[data-selection-box]" )).toHaveCount(0);

  await page.getByRole("button", { name: "Align selected nodes center" }).click();
  await expect(page.locator('[data-node-id="mrr"]')).toHaveCSS("align-self", "center");
  await expect(page.locator('[data-node-id="retention"]')).toHaveCSS("align-self", "center");
  await page.getByRole("button", { name: "Distribute selected nodes evenly" }).click();
  await expect(page.locator('[data-node-id="metrics"]')).toHaveCSS("justify-content", "space-evenly");

  await page.keyboard.press("Control+d");
  await expect(page.locator('[data-tree-node-id="mrr-copy"]')).toBeVisible();
  await expect(page.locator('[data-tree-node-id="retention-copy"]')).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(page.locator('[data-tree-node-id="mrr-copy"]')).toHaveCount(0);
  await expect(page.locator('[data-tree-node-id="retention-copy"]')).toHaveCount(0);

  await page.locator('[data-node-id="mrr"]').click();
  await page.locator('[data-node-id="retention"]').click({ modifiers: ["Shift"] });
  await expect(page.getByText("2 nodes selected", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator('[data-tree-node-id="mrr"]').focus();
  await page.keyboard.press("Control+a");
  await expect(page.getByText("3 nodes selected", { exact: true })).toBeVisible();
});

test("engine v2 groups and ungroups sibling nodes losslessly", async ({ page }) => {
  await page.goto("/app/engine-v2");
  await page.locator('[data-tree-node-id="mrr"]').click();
  await page.locator('[data-tree-node-id="retention"]').click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Group selected nodes", exact: true }).click();

  const group = page.locator('[data-tree-node-id="group"]');
  await expect(group).toBeVisible();
  const groupItem = group.locator("..");
  await expect(groupItem.locator('[data-tree-node-id="mrr"]')).toBeVisible();
  await expect(groupItem.locator('[data-tree-node-id="retention"]')).toBeVisible();

  await page.getByRole("button", { name: "Ungroup selected frame", exact: true }).click();
  await expect(group).toHaveCount(0);
  await expect(page.getByText("2 nodes selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-tree-node-id="group"]')).toBeVisible();
});

test("engine v2 inserts deterministic nodes and pastes fresh copies", async ({ page }) => {
  await page.goto("/app/engine-v2");

  await page.locator('[data-tree-node-id="mrr"]').click();
  await page.getByRole("button", { name: "Add node" }).click();
  await page.getByRole("menuitem", { name: /text/i }).click();
  await expect(page.locator('[data-tree-node-id="text"]')).toBeVisible();
  await expect(page.locator('[data-node-id="text"]')).toHaveText("New text");

  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(page.locator('[data-tree-node-id="text-copy"]')).toBeVisible();
  await page.keyboard.press("Control+v");
  await expect(page.locator('[data-tree-node-id="text-copy-2"]')).toBeVisible();

  for (const type of ["metric", "chart", "frame"] as const) {
    await page.getByRole("button", { name: "Add node" }).click();
    await page.getByRole("menuitem", { name: new RegExp(type, "i") }).click();
    await expect(page.locator(`[data-tree-node-id="${type}"]`)).toBeVisible();
  }

  await page.locator('[data-tree-node-id="frame"]').click();
  await page.getByRole("button", { name: "Add node" }).click();
  await page.getByRole("menuitem", { name: /graph/i }).click();
  await expect(page.locator('[data-tree-node-id="graph"]')).toBeVisible();
  const frameTreeItem = page.locator('[data-tree-node-id="frame"]').locator("..");
  await expect(frameTreeItem.locator('[data-tree-node-id="graph"]')).toBeVisible();
});

test("engine v2 exposes and applies every current node field", async ({ page }) => {
  await page.goto("/app/engine-v2");

  await page.locator('[data-tree-node-id="revenue-chart"]').click();
  await page.getByLabel("Node name").fill("Primary revenue chart");
  await page.getByLabel("Chart title").fill("Revenue test");
  await page.getByLabel("Chart value prefix").fill("USD ");
  await page.getByLabel("Node background").fill("#fff4e8");
  await page.getByLabel("Node borderColor").fill("#ff5d2e");
  await page.getByLabel("Node border width").fill("2");
  await page.getByLabel("Node border radius").fill("20");
  await expect(page.getByRole("heading", { name: "Revenue test" })).toBeVisible();
  await expect(page.locator('[data-node-id="revenue-chart"]')).toHaveCSS("background-color", "rgb(255, 244, 232)");
  await expect(page.locator('[data-tree-node-id="revenue-chart"]')).toContainText("Primary revenue chart");

  await page.locator('[data-tree-node-id="eyebrow"]').click();
  await page.getByLabel("Text style").selectOption("heading");
  await page.getByLabel("Text content", { exact: true }).fill("Editable heading");
  await expect(page.locator('[data-node-id="eyebrow"]')).toContainText("Editable heading");

  await page.locator('[data-tree-node-id="status"]').click();
  await page.getByLabel("Metric tone").selectOption("warning");
  await expect(page.getByLabel("Metric tone")).toHaveValue("warning");

  await page.locator('[data-tree-node-id="analysis"]').click();
  await page.getByLabel("Frame alignment").selectOption("center");
  await page.getByLabel("Frame justification").selectOption("space-between");
  await expect(page.locator('[data-node-id="analysis"]')).toHaveCSS("align-items", "center");
  await expect(page.locator('[data-node-id="analysis"]')).toHaveCSS("justify-content", "space-between");
});

test("engine v2 applies direct-editing state without breaking responsive flow", async ({ page }) => {
  await page.goto("/app/engine-v2");
  await page.locator('[data-tree-node-id="title"]').click();
  const node = page.locator('[data-node-id="title"]');

  await page.getByLabel("Node opacity").fill("0.5");
  await page.getByLabel("Node rotation").fill("12");
  await expect(node).toHaveCSS("opacity", "0.5");
  await expect(node).toHaveCSS("transform", /matrix/);
  await expect(node).toHaveCSS("position", "static");

  await page.getByLabel("Node position mode").selectOption("absolute");
  await page.getByLabel("Node X position").fill("24");
  await page.getByLabel("Node Y position").fill("36");
  await expect(node).toHaveCSS("position", "absolute");
  await expect(node).toHaveCSS("left", "24px");
  await expect(node).toHaveCSS("top", "36px");

  await page.getByLabel("Locked").check();
  await page.getByLabel("Text content", { exact: true }).fill("Ignored while locked");
  await expect(node).toHaveText("Growth without the noise.");
  await page.getByLabel("Locked").uncheck();
  await page.getByLabel("Text content", { exact: true }).fill("Unlocked edit");
  await expect(node).toHaveText("Unlocked edit");

  await page.getByLabel("Visible").uncheck();
  await expect(node).toHaveCSS("visibility", "hidden");
  await page.getByLabel("Visible").check();
  await expect(node).toHaveCSS("visibility", "visible");
});

test("engine v2 previews AI changes before explicit approval", async ({ page }) => {
  await page.route("**/api/ai/engine-v2", async (route) => {
    const request = route.request().postDataJSON() as { currentDocument: { children: Array<{ id: string; type: string; children?: Array<Record<string, unknown>> }> } };
    const proposed = structuredClone(request.currentDocument);
    const find = (nodes: Array<Record<string, unknown>>): Record<string, unknown> | undefined => {
      for (const node of nodes) {
        if (node.id === "title") return node;
        if (Array.isArray(node.children)) {
          const nested = find(node.children as Array<Record<string, unknown>>);
          if (nested) return nested;
        }
      }
      return undefined;
    };
    const title = find(proposed.children as Array<Record<string, unknown>>);
    if (title) title.content = "AI proposed title";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ document: proposed, changeSummary: { changedNodeIds: ["title"], operationCount: 1 } }),
    });
  });
  await page.goto("/app/engine-v2");
  await page.getByRole("button", { name: "Open AI composer" }).click();
  await page.getByLabel("Describe what to build").fill("Improve the selected title");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page.locator("[data-ai-preview='true']")).toBeVisible();
  await expect(page.locator('[data-node-id="title"]')).toHaveText("AI proposed title");
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.locator("[data-ai-preview='true']")).toHaveCount(0);
  await expect(page.locator('[data-node-id="title"]')).toHaveText("Growth without the noise.");

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Apply changes", exact: true }).click();
  await expect(page.locator('[data-node-id="title"]')).toHaveText("AI proposed title");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-node-id="title"]')).toHaveText("Growth without the noise.");
});

test("engine v2 exposes document controls and persistent validation errors", async ({ page }) => {
  await page.goto("/app/engine-v2");

  await page.getByLabel("Document name").fill("Editable systems brief");
  await page.getByLabel("Artboard width").fill("960");
  await page.getByLabel("Artboard minimum height").fill("840");
  await expect(page.getByText("960 × auto", { exact: true })).toBeVisible();
  await expect(page.locator("[data-engine-document='v2'], [data-node-id='root']").first()).toBeVisible();

  await page.locator('[data-tree-node-id="revenue-chart"]').click();
  const chartJson = page.getByLabel("Chart data JSON");
  await chartJson.fill("not json");
  await chartJson.blur();
  await expect(page.getByRole("alert").filter({ hasText: "Chart data must be a valid JSON array" })).toBeVisible();

  await page.locator('[data-tree-node-id="growth-system"]').click();
  const graphJson = page.getByLabel("Graph data JSON");
  await graphJson.fill(JSON.stringify({ nodes: [{ id: "broken" }], edges: [] }));
  await graphJson.blur();
  await expect(page.getByRole("alert").filter({ hasText: "Graph data is invalid" })).toBeVisible();
});

test("engine v2 rejects chart families that do not match existing data", async ({ page }) => {
  await page.goto("/app/engine-v2");
  await page.locator('[data-tree-node-id="revenue-chart"]').click();

  const family = page.getByLabel("Chart family");
  await expect(family).toHaveValue("line");
  await family.selectOption("sankey");
  await expect(family).toHaveValue("line");
  await expect(page.getByRole("alert").filter({ hasText: "cannot be used for a sankey chart" })).toBeVisible();
});

test("engine v3 upgrade preview manages pages and committed color tokens", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await expect(page.getByText("Engine v3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show pages", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Revenue operating brief" })).toBeVisible();

  await page.getByRole("button", { name: "Duplicate page", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(2);
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(3);
  await page.getByText("More settings", { exact: true }).click();
  await page.getByLabel("Page name").fill("Social launch");
  await expect(page.getByRole("tab", { name: "Social launch" })).toBeVisible();
  await page.getByRole("button", { name: "Delete page", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(2);

  const paper = page.getByLabel("Color token paper");
  await paper.fill("#fff000");
  await paper.press("Enter");
  await expect(page.locator("[data-engine-document='v2']")).toHaveCSS("background-color", "rgb(255, 240, 0)");
});

test("engine v3 edits nested nodes and reusable components", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await page.getByRole("button", { name: "Show layers", exact: true }).dispatchEvent("click");
  await page.getByRole("button", { name: "text Report title", exact: true }).click();
  const title = page.locator('[data-node-id="title"]');
  await page.getByLabel("Edit selected text").fill("Editable across pages");
  await expect(title).toHaveText("Editable across pages");

  await page.getByText("More settings", { exact: true }).click();
  await page.getByLabel("V3 node X").fill("18");
  await page.getByLabel("V3 node Y").fill("24");
  await page.getByLabel("V3 node opacity").fill("0.6");
  await expect(title).toHaveCSS("left", "18px");
  await expect(title).toHaveCSS("top", "24px");
  await expect(title).toHaveCSS("opacity", "0.6");

  await page.getByLabel("V3 node locked").check();
  await page.getByLabel("Edit selected text").fill("Blocked edit");
  await expect(title).toHaveText("Editable across pages");
  await expect(page.getByRole("alert").filter({ hasText: "locked" })).toBeVisible();
  await page.getByLabel("V3 node locked").uncheck();
  await page.getByRole("button", { name: "Create component", exact: true }).click();
  await expect(page.getByRole("button", { name: "Detach component", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Detach component", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create component", exact: true })).toBeVisible();
});

test("engine v3 selects canvas elements and undoes document commands", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  await title.click();
  await page.getByText("More settings", { exact: true }).click();
  await expect(page.getByLabel("V3 node name")).toHaveValue("Report title");

  await page.getByLabel("Edit selected text").fill("Direct canvas edit");
  await expect(title).toHaveText("Direct canvas edit");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(title).not.toHaveText("Direct canvas edit");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(title).toHaveText("Direct canvas edit");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByLabel("V3 node X")).toHaveValue("10");
  await page.keyboard.press("Escape");
  await expect(page.getByText("More settings", { exact: true })).toBeVisible();
});

test("engine v3 allows keyboard selection of canvas objects", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const status = page.locator('[data-node-id="status"]');
  await status.focus();
  await page.keyboard.press("Enter");
  await page.getByText("More settings", { exact: true }).click();
  await expect(page.getByLabel("V3 node name")).toHaveValue("Status");
});

test("engine v3 selects all editable objects with Control+A", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await page.locator('[data-node-id="title"]').click();
  const allObjects = await page.locator('[data-node-id]').count();
  await page.keyboard.press("Control+a");
  await expect(page.getByLabel("Group selection bounds")).toBeVisible();
  await expect(page.locator('[data-node-id].outline')).toHaveCount(allObjects - 1);
});

test("engine v3 draws editable pen paths and connector styles", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await page.getByRole("button", { name: "Draw with pen" }).click();
  const canvas = page.locator("[data-engine-document='v2']");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Canvas bounds are unavailable");
  const startX = bounds.x + bounds.width * 0.72;
  const startY = bounds.y + Math.min(bounds.height - 50, 420);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 36, { steps: 5 });
  await page.mouse.up();
  const path = page.locator('[data-node-type="path"]');
  await expect(path).toBeVisible();
  await path.click();
  await expect(page.getByRole("region", { name: "Connector settings" })).toBeVisible();
  await page.getByLabel("Connector line style").selectOption("curve");
  await expect(page.getByLabel("Connector line style")).toHaveValue("curve");
  await page.getByLabel("Connector arrow end").check();
  await expect(page.getByLabel("Connector arrow end")).toBeChecked();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText("110%");
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export active page as PNG" }).click();
  await expect((await pngDownload).suggestedFilename()).toMatch(/\.png$/);
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export active page as PDF" }).click();
  await expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);
});

test("engine v3 provides a visible clear-selection control", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await page.locator('[data-node-id="title"]').click();
  await expect(page.getByLabel("V3 node name")).toHaveValue("Report title");
  const documentSurface = page.locator('[data-engine-document="v2"]');
  await documentSurface.evaluate((element) => element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 })));
  await expect(page.getByLabel("V3 node name")).toHaveValue("Report");
  await page.locator('[data-node-id="title"]').click();
  await page.getByRole("button", { name: "Deselect", exact: true }).click();
  await expect(page.getByLabel("V3 node name")).toHaveValue("Report");
});

test("engine v3 supports Paper-style creation shortcuts", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await page.getByRole("button", { name: "Select tool", exact: true }).focus();
  await page.keyboard.press("t");
  await expect(page.locator('[data-node-id^="text-"]')).toHaveCount(1);
  await page.keyboard.press("r");
  await expect(page.locator('[data-node-id^="card-"]')).toHaveCount(1);
  await page.keyboard.press("f");
  await expect(page.locator('[data-node-id^="frame-"]')).toHaveCount(1);
  await page.keyboard.press("p");
  await expect(page.getByRole("button", { name: "Draw with pen" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("v");
  await expect(page.getByRole("button", { name: "Draw with pen" })).toHaveAttribute("aria-pressed", "false");
});

test("engine v3 supports keyboard zoom shortcuts", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await page.getByRole("button", { name: "Select tool", exact: true }).focus();
  await expect(page.getByRole("button", { name: "Reset zoom", exact: true })).toHaveText("100%");
  await page.keyboard.press("+");
  await expect(page.getByRole("button", { name: "Reset zoom", exact: true })).toHaveText("110%");
  await page.keyboard.press("-");
  await expect(page.getByRole("button", { name: "Reset zoom", exact: true })).toHaveText("100%");
  await page.keyboard.press("+");
  await page.keyboard.press("0");
  await expect(page.getByRole("button", { name: "Reset zoom", exact: true })).toHaveText("100%");
});

test("engine v3 resizes a selected object with modifier arrows", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  await title.click();
  await page.getByText("More settings", { exact: true }).click();
  const width = page.getByLabel("V3 node width");
  await width.fill("280");
  await page.getByRole("button", { name: "Select tool", exact: true }).focus();
  await page.keyboard.press("Control+ArrowRight");
  await expect(width).toHaveValue("281");
  await page.keyboard.press("Control+Shift+ArrowLeft");
  await expect(width).toHaveValue("271");
});

test("engine v3 edits text inline on double click", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  await title.dblclick();
  const editor = page.getByLabel("Inline text editor");
  await expect(editor).toBeVisible();
  await editor.fill("Edited directly on canvas");
  await editor.press("Control+Enter");
  await expect(editor).toBeHidden();
  await expect(page.locator('[data-node-id="title"]')).toContainText("Edited directly on canvas");
});

test("engine v3 starts inline text editing from the keyboard", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  await title.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Inline text editor")).toBeVisible();
});

test("engine v3 copies and pastes a selected node with a fresh identity", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await page.locator('[data-node-id="title"]').click();
  const before = await page.locator('[data-node-type="text"]').count();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(page.locator('[data-node-type="text"]')).toHaveCount(before + 1);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-node-type="text"]')).toHaveCount(before);
});

test("engine v3 cycles sibling selection with Tab", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  await title.click();
  await title.focus();
  await expect(page.getByLabel("V3 node name")).toHaveValue("Report title");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("V3 node name")).not.toHaveValue("Report title");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByLabel("V3 node name")).toHaveValue("Report title");
});

test("engine v3 escapes from a nested layer to its parent", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await page.locator('[data-node-id="title"]').click();
  const name = page.getByLabel("V3 node name");
  await expect(name).toHaveValue("Report title");
  await page.keyboard.press("Escape");
  await expect(name).not.toHaveValue("Report title");
});

test("engine v3 creates a bound connector from two selected objects", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  const status = page.locator('[data-node-id="status"]');
  await title.click();
  await status.evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));
  const connect = page.getByRole("button", { name: "Connect selected objects" });
  await expect(connect).toBeEnabled();
  await connect.click();
  const connector = page.locator('[data-node-type="path"]');
  await expect(connector).toBeVisible();
  await connector.click();
  await expect(page.getByLabel("Connector start node")).toHaveValue("title");
  await expect(page.getByLabel("Connector end node")).toHaveValue("status");
});

test("engine v3 keeps a visible share link when clipboard access is unavailable", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await page.getByRole("button", { name: "Share document", exact: true }).click();
  await expect(page.getByRole("status", { name: "Share link ready" })).toBeVisible();
  const shareUrl = await page.getByLabel("Share link URL").inputValue();
  expect(shareUrl).toMatch(/\/s\//);
  const shared = await page.context().newPage();
  const response = await shared.goto(shareUrl);
  expect(response?.status()).toBe(200);
  await expect(shared.getByText("View-only link.", { exact: false })).toBeVisible();
  await expect(shared.getByRole("heading").first()).toBeVisible();
  await shared.close();
});

test("engine v3 previews, rejects, applies, and undoes an AI proposal", async ({ page }) => {
  await page.route("**/api/ai/engine-v3", async (route) => {
    const request = route.request().postDataJSON() as { document: Record<string, unknown>; revision: number };
    const preview = structuredClone(request.document) as { pages: Array<{ id: string; root: { children: Array<Record<string, unknown>> } }> };
    const patch = (items: Array<Record<string, unknown>>) => items.map((item) => item.id === "title" ? { ...item, content: "AI preview title" } : item.type === "frame" ? { ...item, children: patch(item.children as Array<Record<string, unknown>>) } : item);
    preview.pages[0].root.children = patch(preview.pages[0].root.children);
    const command = { kind: "batch", commands: [{ kind: "node", action: "patch", pageId: preview.pages[0].id, nodeId: "title", changes: { content: "AI preview title" } }] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ proposal: { envelope: { id: "ai-test", baseRevision: request.revision, actor: "agent", origin: "ai", timestamp: "2026-08-31T00:00:00.000Z", command }, preview, affectedIds: ["title"], explanation: "Updated the selected title" } }) });
  });
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  await title.click();
  const original = await title.textContent();
  await page.getByLabel("AI edit prompt").fill("Make the title clearer");
  await page.getByRole("button", { name: "Propose", exact: true }).click();
  await expect(page.getByRole("status", { name: "AI change proposal" })).toBeVisible();
  await expect(title).toHaveText("AI preview title");
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(title).toHaveText(original ?? "");
  await page.getByRole("button", { name: "Propose", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(title).toHaveText("AI preview title");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(title).toHaveText(original ?? "");
});

test("engine v3 uploads and places a persistent image asset", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  await page.getByLabel("Upload image asset").setInputFiles("apps/web/public/icons/cloud/aws/aws-s3.png");
  const image = page.locator('[data-node-type="image"]');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /\/api\/engine-v3\/assets\?sha256=/);
  await page.getByText("More settings", { exact: true }).click();
  await expect(page.getByLabel("V3 node name")).toHaveValue("Image");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(image).toHaveCount(0);
});

test("engine v3 drags a canvas node as one undoable gesture", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  const bounds = await title.boundingBox();
  if (!bounds) throw new Error("Title bounds are unavailable");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 48, bounds.y + bounds.height / 2 + 32, { steps: 4 });
  await page.mouse.up();
  await page.getByText("More settings", { exact: true }).click();
  await expect(page.getByLabel("V3 node X")).not.toHaveValue("0");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("V3 node X")).toHaveValue("0");
  await expect(page.getByLabel("V3 node Y")).toHaveValue("0");
});

test("engine v3 drags Shift-selected nodes together", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  const revenue = page.locator('[data-node-id="mrr"]');
  await title.click();
  await page.getByRole("button", { name: "Show layers", exact: true }).click();
  await page.getByLabel("Include Monthly revenue in group selection").check();
  await page.getByRole("button", { name: "Close layers", exact: true }).click();
  await expect(page.getByLabel("Group selection bounds")).toBeVisible();
  const titleBefore = await title.boundingBox();
  const revenueBefore = await revenue.boundingBox();
  if (!titleBefore || !revenueBefore) throw new Error("Multi-selection geometry is unavailable");
  await page.mouse.move(titleBefore.x + titleBefore.width / 2, titleBefore.y + titleBefore.height / 2);
  await page.mouse.down();
  await page.mouse.move(titleBefore.x + titleBefore.width / 2 + 40, titleBefore.y + titleBefore.height / 2 + 24, { steps: 4 });
  await page.mouse.up();
  const titleAfter = await title.boundingBox();
  const revenueAfter = await revenue.boundingBox();
  expect(titleAfter?.x ?? 0).toBeGreaterThan(titleBefore.x);
  expect(revenueAfter?.x ?? 0).toBeGreaterThan(revenueBefore.x);
  expect((titleAfter?.x ?? 0) - titleBefore.x).toBeCloseTo((revenueAfter?.x ?? 0) - revenueBefore.x, 0);
});

test("engine v3 selects objects with a marquee on empty canvas", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const surface = page.locator('[data-engine-document="v2"]');
  const title = page.locator('[data-node-id="title"]');
  const surfaceBounds = await surface.boundingBox();
  const titleBounds = await title.boundingBox();
  if (!surfaceBounds || !titleBounds) throw new Error("Marquee geometry is unavailable");
  const start = { x: surfaceBounds.x + 4, y: surfaceBounds.y + 4 };
  const end = { x: titleBounds.x + titleBounds.width + 12, y: titleBounds.y + titleBounds.height + 12 };
  await surface.evaluate((element, points) => {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: points.start.x, clientY: points.start.y }));
    window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, button: 0, clientX: points.end.x, clientY: points.end.y }));
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, clientX: points.end.x, clientY: points.end.y }));
  }, { start, end });
  await expect(page.getByLabel("V3 node name")).toHaveValue("Header");
  await expect(title).toHaveClass(/outline/);
  await expect(page.getByLabel("Marquee selection")).toHaveCount(0);
});

test("engine v3 resizes and groups layers through reversible commands", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  await title.click();
  const before = await title.boundingBox();
  const handle = page.getByRole("button", { name: "Resize selected node se", exact: true });
  const handleBounds = await handle.boundingBox();
  if (!before || !handleBounds) throw new Error("Resize geometry is unavailable");
  await page.mouse.move(handleBounds.x + 4, handleBounds.y + 4);
  await page.mouse.down();
  await page.mouse.move(handleBounds.x + 64, handleBounds.y + 36, { steps: 4 });
  await page.mouse.up();
  const after = await title.boundingBox();
  expect(after?.width).toBeGreaterThan(before.width);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await title.boundingBox())?.width).toBeCloseTo(before.width, 0);

  await page.getByText("More settings", { exact: true }).click();
  await page.getByRole("button", { name: "Show layers", exact: true }).click();
  await page.getByLabel("Include Report title in group selection").uncheck();
  await page.getByLabel("Include Monthly revenue in group selection").check();
  await page.getByLabel("Include Net retention in group selection").check();
  await page.getByRole("button", { name: "Group", exact: true }).click();
  await expect(page.getByRole("button", { name: "frame Group", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "metric Monthly revenue", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "metric Net retention", exact: true })).toBeVisible();
});

test("engine v3 exposes independent corner resize handles", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  await title.click();
  const handles = page.getByRole("button", { name: /^Resize selected node / });
  await expect(handles).toHaveCount(8);
  const before = await title.boundingBox();
  const northwest = page.getByRole("button", { name: "Resize selected node nw", exact: true });
  const handleBounds = await northwest.boundingBox();
  if (!before || !handleBounds) throw new Error("Northwest resize geometry is unavailable");
  await page.mouse.move(handleBounds.x + 4, handleBounds.y + 4);
  await page.mouse.down();
  await page.mouse.move(handleBounds.x + 24, handleBounds.y + 18, { steps: 3 });
  await page.mouse.up();
  const after = await title.boundingBox();
  expect(after?.width).toBeLessThan(before.width);
  expect(after?.x).toBeGreaterThan(before.x);
  expect(after?.y).toBeGreaterThan(before.y);
  await expect(page.getByLabel("V3 node width")).not.toHaveValue("");
  await expect(page.getByLabel("V3 node height")).not.toHaveValue("");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await title.boundingBox())?.width).toBeCloseTo(before.width, 0);
});

test("engine v3 rotates a selected node with the canvas handle", async ({ page }) => {
  await page.goto("/app/engine-v2?mode=v3");
  const title = page.locator('[data-node-id="title"]');
  await title.click();
  const handle = page.getByRole("button", { name: "Rotate selected node", exact: true });
  await expect(handle).toBeVisible();
  const bounds = await handle.boundingBox();
  if (!bounds) throw new Error("Rotation geometry is unavailable");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 48, bounds.y + 18, { steps: 4 });
  await page.mouse.up();
  await page.getByText("More settings", { exact: true }).click();
  await expect(page.getByLabel("V3 node rotation")).not.toHaveValue("0");
});
