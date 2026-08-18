const { chromium } = require("@playwright/test");
const path = require("path");

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  
  console.log("Navigating to http://localhost:3040/test ...");
  await page.goto("http://localhost:3040/test", { waitUntil: "networkidle", timeout: 30000 });
  
  const targetDir = "/Users/redforman/.gemini/antigravity/brain/030f7889-3adf-4458-a2a1-300588d217fd";
  
  const selector = "#dashboard-6";
  console.log("Capturing " + selector + "...");
  const element = await page.locator(selector);
  const outputPath = path.join(targetDir, "dashboard_render_6.png");
  await element.screenshot({ path: outputPath });
  console.log("Saved: " + outputPath);
  
  await browser.close();
  console.log("Done.");
})().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
