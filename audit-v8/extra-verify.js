const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots-verify');
const fileUrl = (f) => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(fileUrl('adhd-v8.html'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  // Scroll to first section with Spotify/Apple pills
  await page.evaluate(() => {
    const el = document.querySelector('.btn-podcast-inline');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS, 'fix1-adhd-pills-mobile.png'), fullPage: false });
  await ctx.close();
  await browser.close();
})();
