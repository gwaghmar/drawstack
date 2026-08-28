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
