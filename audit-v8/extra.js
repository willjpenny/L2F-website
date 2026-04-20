// Extra targeted captures — A-Z view on topics, mobile menu open on homepage.
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const fileUrl = (f) => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();

  // Topics A-Z view at desktop-lg and mobile-md
  for (const vp of [{ name: 'desktop-lg', width: 1440, height: 900 }, { name: 'mobile-md', width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(fileUrl('topics-v8.html'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    // Click A-Z button
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /A[–-]Z/.test(b.textContent || ''));
      if (btn) btn.click();
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `topics-${vp.name}-az-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(SHOTS, `topics-${vp.name}-az-fold.png`), fullPage: false });
    await ctx.close();
    console.log(`captured topics A-Z @ ${vp.name}`);
  }

  // Homepage mobile menu open
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page2 = await ctx2.newPage();
  await page2.goto(fileUrl('homepage-v8.html'), { waitUntil: 'networkidle' });
  await page2.waitForTimeout(400);
  const ham = await page2.$('#nav-hamburger');
  if (ham) await ham.click();
  await page2.waitForTimeout(300);
  await page2.screenshot({ path: path.join(SHOTS, `homepage-mobile-md-menu-open.png`), fullPage: false });
  console.log('captured homepage mobile menu open');
  await ctx2.close();

  // Scroll-mid sticky nav verification — screenshot at 50% on homepage desktop-md
  const ctx3 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page3 = await ctx3.newPage();
  await page3.goto(fileUrl('homepage-v8.html'), { waitUntil: 'networkidle' });
  await page3.waitForTimeout(400);
  await page3.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.5, behavior: 'instant' }));
  await page3.waitForTimeout(250);
  await page3.screenshot({ path: path.join(SHOTS, `homepage-desktop-md-midscroll.png`), fullPage: false });
  console.log('captured homepage mid-scroll');
  await ctx3.close();

  await browser.close();
})();
