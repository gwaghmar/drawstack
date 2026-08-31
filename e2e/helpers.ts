import type { Page } from "@playwright/test";

/** Dev-only demo credentials sign-in. Prefer Enter to submit — button click alone may not complete the server action in automated browsers. */
export async function demoSignIn(page: Page, email: string) {
  await page.goto("/login");
  const emailInput = page.getByPlaceholder("dev@example.com");
  await emailInput.fill(email);
  const waitForApp = () => page.waitForURL(/\/app(?:\/|$)/, { timeout: 30_000 });

  // Prefer explicit demo button click; it is the stable submit path in this app.
  const demoSignInBtn = page.locator('button:has-text("Demo sign-in")').first();
  if ((await demoSignInBtn.count()) > 0) {
    await Promise.all([waitForApp(), demoSignInBtn.click()]);
    return;
  }

  await Promise.all([waitForApp(), emailInput.press("Enter")]);
}
