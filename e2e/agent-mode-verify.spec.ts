import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// Inline demo sign-in (the shared helper's input[name=email] selector is now
// ambiguous because /login gained a second email field).
async function devSignIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("dev@example.com").fill(email);
  await Promise.all([
    page.waitForURL(/\/app(?:\/|$)/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Demo sign-in" }).click(),
  ]);
}

// One-off runtime verification of the Agent Mode Polish milestone.
// Drives the real agent route (Google/OpenAI key in apps/web/.env) so tool
// calls actually fire, and captures screenshots of the new tool cards.
test.describe("Agent Mode Polish — runtime verification", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  // The agent-prompt portion needs a VALID AI key in apps/web/.env. Guarded so
  // the normal `pnpm test` suite skips it; run with RUN_AGENT_VERIFY=1 to drive.
  test.skip(!process.env.RUN_AGENT_VERIFY, "set RUN_AGENT_VERIFY=1 (and a valid AI key) to run");

  test("discoverability caption + agent tool cards", async ({ page }, testInfo) => {
    const shot = async (name: string) => {
      const path = testInfo.outputPath(`${name}.png`);
      await page.screenshot({ path, fullPage: false });
      await testInfo.attach(name, { path, contentType: "image/png" });
      return path;
    };

    const consoleErrors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

    await devSignIn(page, `agentverify-${Date.now()}@example.com`);
    await page.goto("/app/editor");
    await expect(page).toHaveURL(/\/app\/editor/);

    const prompt = page.getByPlaceholder("How should I change the diagram?");
    await expect(prompt).toBeVisible({ timeout: 30_000 });

    // Seed a known freeform document so apply_ops has a deterministic target.
    const sourceToggle = page.getByRole("button", { name: /Source/ }).first();
    if (await sourceToggle.count()) await sourceToggle.click();
    const sourceArea = page.locator("pre.hl-pre + textarea");
    if (await sourceArea.isVisible().catch(() => false)) {
      await sourceArea.fill(JSON.stringify({
        version: 1,
        shapes: [
          { id: "s_start", name: "start", type: "rectangle", x: 100, y: 100, width: 180, height: 80, text: { content: "Start" } },
        ],
      }));
    }
    await shot("01-editor-seeded");

    // --- Discoverability (deterministic, no LLM) ---
    const agentToggle = page.getByRole("button", { name: /Agent Mode/ });
    await expect(agentToggle).toBeVisible();
    await agentToggle.click();
    const caption = page.getByText(/Agent mode: the AI takes multiple steps/i);
    await expect(caption).toBeVisible();
    await shot("02-agent-mode-on-caption");

    const sendAgent = async (text: string) => {
      await prompt.fill(text);
      const resp = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/api/ai/agent"), { timeout: 60_000 }).catch(() => null),
        prompt.press("Enter"),
      ]).then(([r]) => r);
      await page.waitForTimeout(2500);
      return resp;
    };

    // --- Agent prompt 1: set_title (keyword-free title to dodge template intercept) ---
    // LLM-dependent: observed + logged, not asserted (so a missing/invalid AI key
    // doesn't fail the deterministic checks above).
    const resp1 = await sendAgent("Set the diagram title to Team Overview");
    const anyToolCard = page.locator("div.rounded-xl.bg-slate-50, div.rounded-xl.dark\\:bg-slate-800").filter({ hasText: /./ });
    const renamed = page.getByText(/Renamed to/i);
    await renamed.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
    await shot("03-after-rename-prompt");

    // --- Agent prompt 2: targeted freeform edit through the current scene-graph tool ---
    await sendAgent('Use apply_ops to change the text of the shape named "start" to "Done"');
    const appliedOp = page.getByText(/Applied 1 op/i);
    await appliedOp.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
    await shot("04-apply-ops-update");

    // Report observations (printed to the Playwright stdout).
    console.log("[verify] agent resp1 status:", resp1?.status() ?? "no-response");
    console.log("[verify] tool cards seen:", await anyToolCard.count());
    console.log("[verify] 'Renamed to' visible:", await renamed.isVisible().catch(() => false));
    console.log("[verify] 'Applied 1 op' visible:", await appliedOp.isVisible().catch(() => false));
    console.log("[verify] console errors:", consoleErrors.length, consoleErrors.slice(0, 5));
  });
});
