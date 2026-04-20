// Targeted verification: check each of the 5 fixes lands across the relevant viewports.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots-verify');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS);
const fileUrl = (f) => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');

const MOBILE_VPS = [
  { name: 'mobile-lg', width: 414, height: 896 },
  { name: 'mobile-md', width: 390, height: 844 },
  { name: 'mobile-sm', width: 375, height: 667 }
];
const TABLET = { name: 'tablet', width: 768, height: 1024 };
const DESKTOPS = [
  { name: 'desktop-xl', width: 1920, height: 1080 },
  { name: 'desktop-lg', width: 1440, height: 900 },
  { name: 'desktop-md', width: 1366, height: 768 }
];

function fmt(label, pass, detail) {
  const tag = pass ? '✅' : '❌';
  return `${tag} ${label}${detail ? ' — ' + detail : ''}`;
}

const results = [];
function log(line) { console.log(line); results.push(line); }

(async () => {
  const browser = await chromium.launch();

  // ═════════════════════════════════════════════════════
  // FIX #5: Homepage hero says "31 topics" not "29"
  // ═════════════════════════════════════════════════════
  log('\n━━━ FIX #5: Homepage hero "31 topics" (not 29) ━━━');
  {
    const ctx = await browser.newContext({ viewport: DESKTOPS[0] });
    const page = await ctx.newPage();
    await page.goto(fileUrl('homepage-v8.html'), { waitUntil: 'networkidle' });
    const heroText = await page.evaluate(() => document.querySelector('.hero-sub')?.innerText || '');
    const has31 = /covering 31 health/.test(heroText);
    const has29 = /covering 29 health/.test(heroText);
    log(fmt('hero-sub contains "covering 31 health"', has31, heroText.slice(0, 100)));
    log(fmt('hero-sub does NOT contain "29 health"', !has29));
    await ctx.close();
  }

  // ═════════════════════════════════════════════════════
  // FIX #4: "Now playing" badge hidden on ≤600px viewports
  // ═════════════════════════════════════════════════════
  log('\n━━━ FIX #4: "Now playing" badge hidden on small mobile ━━━');
  for (const vp of MOBILE_VPS) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(fileUrl('homepage-v8.html'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const badgeInfo = await page.evaluate(() => {
      const b = document.querySelector('.play-indicator');
      if (!b) return { exists: false };
      const cs = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      return { exists: true, display: cs.display, width: Math.round(r.width), height: Math.round(r.height) };
    });
    const shouldBeHidden = vp.width <= 600;
    const isHidden = badgeInfo.display === 'none' || (badgeInfo.width === 0 && badgeInfo.height === 0);
    const pass = shouldBeHidden ? isHidden : true; // we only require hide ≤600
    log(fmt(`badge at ${vp.name} (${vp.width}px) hidden?`, pass, `display=${badgeInfo.display}, rect=${badgeInfo.width}×${badgeInfo.height}`));
    // Also verify quote is not occluded: get badge and clip-question rects
    const overlapCheck = await page.evaluate(() => {
      const badges = document.querySelectorAll('.play-indicator');
      const quotes = document.querySelectorAll('.clip-question');
      const overlaps = [];
      badges.forEach(b => {
        const br = b.getBoundingClientRect();
        if (br.width === 0 && br.height === 0) return;
        quotes.forEach(q => {
          const qr = q.getBoundingClientRect();
          const x = !(br.right < qr.left || br.left > qr.right || br.bottom < qr.top || br.top > qr.bottom);
          if (x) overlaps.push({ br: [Math.round(br.left), Math.round(br.top), Math.round(br.right), Math.round(br.bottom)], qr: [Math.round(qr.left), Math.round(qr.top), Math.round(qr.right), Math.round(qr.bottom)] });
        });
      });
      return overlaps;
    });
    log(fmt(`no badge/quote overlap at ${vp.name}`, overlapCheck.length === 0, overlapCheck.length ? JSON.stringify(overlapCheck[0]) : ''));
    await page.screenshot({ path: path.join(SHOTS, `fix4-homepage-${vp.name}-fold.png`), fullPage: false });
    await ctx.close();
  }
  // And on desktop badge should still be visible (not over-corrected)
  for (const vp of DESKTOPS) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(fileUrl('homepage-v8.html'), { waitUntil: 'networkidle' });
    const badgeVisible = await page.evaluate(() => {
      const b = document.querySelector('.play-indicator');
      if (!b) return false;
      const cs = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      return cs.display !== 'none' && r.width > 0 && r.height > 0;
    });
    log(fmt(`badge still visible on ${vp.name}`, badgeVisible));
    await ctx.close();
  }

  // ═════════════════════════════════════════════════════
  // FIX #3: Topics "N topics" count does not orphan-wrap on mobile
  // ═════════════════════════════════════════════════════
  log('\n━━━ FIX #3: Topics category-count never orphans digit from "topics" ━━━');
  for (const vp of [...MOBILE_VPS, TABLET]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(fileUrl('topics-v8.html'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const check = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.category-count').forEach(el => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        // A single span with white-space:nowrap should be one line — so its clientHeight is 1× line height
        out.push({
          text: el.textContent.trim(),
          whiteSpace: cs.whiteSpace,
          width: Math.round(r.width),
          height: Math.round(r.height),
          // Check: client rect height vs font-size — if multi-line, height will be ~2× line height
          lineCount: Math.round(r.height / (parseFloat(cs.fontSize) * (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.5)))
        });
      });
      return out;
    });
    const allNowrap = check.every(c => c.whiteSpace === 'nowrap');
    log(fmt(`[${vp.name}] all .category-count spans have white-space:nowrap`, allNowrap, check[0] ? `sample: "${check[0].text}" w=${check[0].width}` : ''));
    await page.screenshot({ path: path.join(SHOTS, `fix3-topics-${vp.name}-fold.png`), fullPage: false });
    await ctx.close();
  }

  // ═════════════════════════════════════════════════════
  // FIX #2: Topics category tab fade indicator visible below 1100px
  // ═════════════════════════════════════════════════════
  log('\n━━━ FIX #2: Topics cat-nav fade indicator ━━━');
  for (const vp of [TABLET, ...MOBILE_VPS, DESKTOPS[2]]) { // also include desktop-md 1366 to confirm fade hidden at large
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(fileUrl('topics-v8.html'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const fadeInfo = await page.evaluate(() => {
      const nav = document.querySelector('.cat-nav');
      if (!nav) return { exists: false };
      const after = getComputedStyle(nav, '::after');
      return {
        exists: true,
        content: after.content,
        display: after.display,
        width: after.width,
        background: after.background.slice(0, 80)
      };
    });
    const shouldShow = vp.width < 1100;
    const visible = fadeInfo.content !== 'none' && fadeInfo.display !== 'none';
    const pass = shouldShow ? visible : !visible;
    log(fmt(`[${vp.name}] fade ${shouldShow ? 'shown' : 'hidden'}`, pass, `content=${fadeInfo.content} display=${fadeInfo.display}`));
    // Also confirm cat-nav-inner still scrolls horizontally when overflowing
    const scrollable = await page.evaluate(() => {
      const inner = document.querySelector('.cat-nav-inner');
      if (!inner) return null;
      return { scrollWidth: inner.scrollWidth, clientWidth: inner.clientWidth };
    });
    if (scrollable) {
      const overflows = scrollable.scrollWidth > scrollable.clientWidth;
      log(fmt(`[${vp.name}] cat-nav-inner actually has overflow`, vp.width < 900 ? overflows : true, `scroll=${scrollable.scrollWidth} client=${scrollable.clientWidth}`));
    }
    await page.screenshot({ path: path.join(SHOTS, `fix2-topics-${vp.name}-fold.png`), fullPage: false });
    await ctx.close();
  }

  // ═════════════════════════════════════════════════════
  // FIX #1: Mobile tap targets ≥ 44×44 (or close) on relevant elements
  // ═════════════════════════════════════════════════════
  log('\n━━━ FIX #1: Mobile tap targets ≥44×44 on key elements ━━━');
  const targetMap = {
    'homepage-v8.html': [
      { sel: '#nav-hamburger', label: 'hamburger', min: 44 },
      { sel: '.reel-nav.prev', label: 'reel prev', min: 44 },
      { sel: '.reel-nav.next', label: 'reel next', min: 44 },
      { sel: '#reel-pause', label: 'reel pause', min: 40 },
      { sel: '.clip-watch', label: 'clip watch', min: 44 },
      { sel: '.btn-spotify', label: 'Spotify CTA', min: 44 },
      { sel: '.btn-apple', label: 'Apple CTA', min: 44 }
    ],
    'topics-v8.html': [
      { sel: '#nav-hamburger', label: 'hamburger', min: 44 },
      { sel: '.view-toggle button.active', label: 'By category toggle', min: 44 },
      { sel: '.view-toggle button:not(.active)', label: 'A-Z toggle', min: 44 }
    ],
    'adhd-v8.html': [
      { sel: '#nav-hamburger', label: 'hamburger', min: 44 },
      { sel: '.btn-podcast-inline.spotify', label: 'inline Spotify pill', min: 44 },
      { sel: '.btn-podcast-inline.apple', label: 'inline Apple pill', min: 44 },
      { sel: '.btn-download-inline', label: 'Summary PDF pill', min: 44 },
      { sel: '.btn-view-all', label: 'View all videos', min: 44 }
    ]
  };
  for (const [file, targets] of Object.entries(targetMap)) {
    for (const vp of MOBILE_VPS) {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      await page.goto(fileUrl(file), { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      for (const t of targets) {
        const size = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 };
        }, t.sel);
        if (!size || !size.visible) {
          log(fmt(`${file.replace('-v8.html','')} @ ${vp.name}: ${t.label}`, false, `element not visible (selector ${t.sel})`));
        } else {
          const pass = size.w >= t.min && size.h >= t.min;
          log(fmt(`${file.replace('-v8.html','')} @ ${vp.name}: ${t.label} ${size.w}×${size.h} (min ${t.min})`, pass));
        }
      }
      // Also run the full tap-target sweep to make sure nothing crept back
      const smallCount = await page.evaluate(() => {
        let n = 0;
        document.querySelectorAll('button, a').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (r.width < 40 || r.height < 40) n++;
        });
        return n;
      });
      log(`   [${file.replace('-v8.html','')} @ ${vp.name}] elements still under 40×40: ${smallCount}`);
      await ctx.close();
    }
  }

  // ═════════════════════════════════════════════════════
  // REGRESSION: Make sure original audit checks still clean
  // ═════════════════════════════════════════════════════
  log('\n━━━ REGRESSION: no new horizontal overflow, no new console errors ━━━');
  for (const file of ['homepage-v8.html', 'topics-v8.html', 'adhd-v8.html']) {
    for (const vp of [DESKTOPS[0], DESKTOPS[2], TABLET, MOBILE_VPS[1]]) {
      const errs = [], msgs = [];
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      page.on('pageerror', e => errs.push(e.message.slice(0, 150)));
      page.on('console', m => { if (m.type() === 'error') msgs.push(m.text().slice(0, 150)); });
      await page.goto(fileUrl(file), { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
      const hOverflow = scroll.s > scroll.c + 1;
      log(fmt(`[${file.replace('-v8.html','')} @ ${vp.name}] no horizontal overflow`, !hOverflow, `sw=${scroll.s} cw=${scroll.c}`));
      log(fmt(`[${file.replace('-v8.html','')} @ ${vp.name}] no JS errors`, errs.length === 0 && msgs.length === 0, errs.concat(msgs).join(' | ')));
      await ctx.close();
    }
  }

  await browser.close();
  log('\nVerification complete.');
  fs.writeFileSync(path.join(__dirname, 'verify-log.txt'), results.join('\n'));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
