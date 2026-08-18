const { chromium } = require("@playwright/test");
const path = require("path");

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  
  console.log("Navigating to http://localhost:3040/test-complex ...");
  await page.goto("http://localhost:3040/test-complex", { waitUntil: "networkidle", timeout: 30000 });
  
  // Wait a moment for animations and charts to draw
  await page.waitForTimeout(2000);

  const targetDir = "/Users/redforman/.gemini/antigravity/brain/030f7889-3adf-4458-a2a1-300588d217fd";
  const outputPath = path.join(targetDir, "orbital_command.png");
  
  console.log("Capturing page...");
  await page.screenshot({ path: outputPath, fullPage: true });
  console.log("Saved: " + outputPath);
  
  await browser.close();
  console.log("Done.");
})().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
