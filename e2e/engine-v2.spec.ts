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
  await expect(page.getByRole("tab", { name: "Revenue operating brief" })).toBeVisible();

  await page.getByRole("button", { name: "Duplicate page", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(2);
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(3);
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
  await page.getByRole("button", { name: "text Report title", exact: true }).click();
  const title = page.locator('[data-node-id="title"]');
  await page.getByLabel("V3 text content").fill("Editable across pages");
  await expect(title).toHaveText("Editable across pages");

  await page.getByLabel("V3 node X").fill("18");
  await page.getByLabel("V3 node Y").fill("24");
  await page.getByLabel("V3 node opacity").fill("0.6");
  await expect(title).toHaveCSS("left", "18px");
  await expect(title).toHaveCSS("top", "24px");
  await expect(title).toHaveCSS("opacity", "0.6");

  await page.getByLabel("V3 node locked").check();
  await page.getByLabel("V3 text content").fill("Blocked edit");
  await expect(title).toHaveText("Editable across pages");
  await expect(page.getByRole("alert").filter({ hasText: "locked" })).toBeVisible();
  await page.getByLabel("V3 node locked").uncheck();
  await page.getByRole("button", { name: "Create component", exact: true }).click();
  await expect(page.getByRole("button", { name: "Detach component", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Detach component", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create component", exact: true })).toBeVisible();
});
