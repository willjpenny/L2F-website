// Inspect what's still under 40x40 after fixes — expected to be footer / cosmetic.
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fileUrl = (f) => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  for (const file of ['homepage-v8.html', 'topics-v8.html', 'adhd-v8.html']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(fileUrl(file), { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const list = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button, a').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.width < 40 || r.height < 40) {
          const cls = (typeof el.className === 'string' ? el.className : '').split(' ').filter(Boolean)[0] || '';
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: cls,
            w: Math.round(r.width),
            h: Math.round(r.height),
            text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 28).replace(/\n/g, ' ').trim(),
            parentCls: (el.parentElement && typeof el.parentElement.className === 'string') ? el.parentElement.className.split(' ').filter(Boolean)[0] || '' : ''
          });
        }
      });
      return out;
    });
    console.log(`\n━━ ${file} @ mobile-md (under 40×40) ━━`);
    list.forEach(i => console.log(`  <${i.tag}.${i.cls}> ${i.w}×${i.h} "${i.text}" (parent: .${i.parentCls})`));
    await ctx.close();
  }
  await browser.close();
})();
