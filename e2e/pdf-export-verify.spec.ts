import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Inline demo sign-in (the shared helper's input[name=email] selector is now
// ambiguous because /login has a second email field).
async function devSignIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("dev@example.com").fill(email);
  await Promise.all([
    page.waitForURL(/\/app(?:\/|$)/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Demo sign-in" }).click(),
  ]);
}

test("exports a real PDF from the editor", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await devSignIn(page, `pdf-${Date.now()}@example.com`);
  await page.goto("/app/editor");

  const prompt = page.getByPlaceholder("How should I change the diagram?");
  await expect(prompt).toBeVisible({ timeout: 30_000 });
  // Wait until the current freeform Konva canvas has mounted before capturing it.
  await expect(page.locator(".konvajs-content canvas").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);

  // Open the export menu and click PDF.
  const exportRoot = page.locator("[data-export-menu-root]").first();
  const exportBtn = exportRoot.getByRole("button", { name: /Export/ });
  await expect(exportBtn).toBeVisible();
  await exportBtn.click();
  const pdfBtn = exportRoot.getByRole("button", { name: "PDF", exact: true });
  await expect(pdfBtn).toBeVisible();

  const download = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    pdfBtn.click(),
  ]).then(([d]) => d);

  // Filename ends in .pdf
  expect(download.suggestedFilename().endsWith(".pdf")).toBeTruthy();

  // Save it and assert it's a real, non-trivial PDF (magic bytes + size).
  const out = testInfo.outputPath("export.pdf");
  await download.saveAs(out);
  const bytes = readFileSync(out);
  expect(bytes.length).toBeGreaterThan(1000);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  await testInfo.attach("exported.pdf", { path: out, contentType: "application/pdf" });
  console.log("[verify] pdf filename:", download.suggestedFilename(), "bytes:", bytes.length);
});
