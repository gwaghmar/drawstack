const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3040/app/templates', { waitUntil: 'networkidle' });
  
  // click the SaaS dashboard template
  await page.click('text="SaaS Dashboard Widget (Hybrid)"');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'saas_hybrid.png' });
  console.log("Captured saas_hybrid.png");
  
  await browser.close();
}

main().catch(console.error);
