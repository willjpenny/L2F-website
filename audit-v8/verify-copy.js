// Verify the "videos & podcasts" copy changes render correctly and don't break layout.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots-verify');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS);
const fileUrl = (f) => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');

const CHECKS = [
  { file: 'homepage-v8.html', sel: '.hero-sub', needle: 'videos & podcasts and resources', forbid: 'videos and resources' },
  { file: 'homepage-v8.html', sel: 'input[type=search]', attr: 'placeholder', needle: 'videos & podcasts', forbid: null },
  { file: 'topics-v8.html',   sel: '.page-header-sub', needle: 'videos & podcasts and resources', forbid: 'videos and resources' },
  { file: 'adhd-v8.html',     sel: '.intro-section p:nth-of-type(1)', needle: 'specialist videos & podcasts', forbid: 'specialist videos are designed' },
  { file: 'adhd-v8.html',     sel: '.intro-section p:nth-of-type(3)', needle: 'videos & podcasts on this page', forbid: 'videos on this page are produced' }
];

const VIEWPORTS = [
  { name: 'desktop-xl', width: 1920, height: 1080 },
  { name: 'desktop-md', width: 1366, height: 768 },
  { name: 'tablet',     width: 768,  height: 1024 },
  { name: 'mobile-md',  width: 390,  height: 844 }
];

(async () => {
  const browser = await chromium.launch();
  let pass = 0, fail = 0;
  for (const chk of CHECKS) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      await page.goto(fileUrl(chk.file), { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      const text = await page.evaluate(({ sel, attr }) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return attr ? el.getAttribute(attr) : el.innerText;
      }, chk);
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      const has = text && text.includes(chk.needle);
      const forbidden = chk.forbid && text && text.includes(chk.forbid);
      const ok = has && !forbidden && !overflows;
      if (ok) pass++; else fail++;
      console.log(`${ok ? '✅' : '❌'} [${chk.file.replace('-v8.html','')} @ ${vp.name}] ${chk.sel}`);
      if (!ok) {
        console.log(`   needle="${chk.needle}" found=${has} forbiddenStillPresent=${forbidden} overflow=${overflows}`);
        console.log(`   text: "${(text||'').slice(0, 150)}"`);
      }
      await ctx.close();
    }
  }

  // Screenshots of the updated hero/intro at each key viewport
  for (const vp of VIEWPORTS) {
    for (const file of ['homepage-v8.html', 'topics-v8.html', 'adhd-v8.html']) {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      await page.goto(fileUrl(file), { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(SHOTS, `copy-${file.replace('-v8.html','')}-${vp.name}-fold.png`), fullPage: false });
      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
