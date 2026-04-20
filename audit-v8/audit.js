// V8 Mockup Audit — runs all three pages at 7 viewports headless.
// Uses playwright from the existing npx cache via NODE_PATH.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = __dirname;
const SHOTS = path.join(OUT, 'screenshots');

const PAGES = [
  { name: 'homepage', file: 'homepage-v8.html' },
  { name: 'topics',   file: 'topics-v8.html' },
  { name: 'adhd',     file: 'adhd-v8.html' }
];

const VIEWPORTS = [
  { name: 'desktop-xl', width: 1920, height: 1080 },
  { name: 'desktop-lg', width: 1440, height: 900 },
  { name: 'desktop-md', width: 1366, height: 768 },
  { name: 'tablet',     width: 768,  height: 1024 },
  { name: 'mobile-lg',  width: 414,  height: 896 },
  { name: 'mobile-md',  width: 390,  height: 844 },
  { name: 'mobile-sm',  width: 375,  height: 667 }
];

const fileUrl = (f) => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');

// ── In-page checks (serialised as a single function body) ──
async function runChecks(page, viewport) {
  return await page.evaluate((vp) => {
    const issues = [];
    const info = {};

    // 1. Horizontal page overflow
    const de = document.documentElement;
    const scrollW = de.scrollWidth;
    const clientW = de.clientWidth;
    info.scrollWidth = scrollW;
    info.clientWidth = clientW;
    info.totalHeight = de.scrollHeight;
    if (scrollW > clientW + 1) {
      issues.push({
        type: 'horizontal-overflow',
        severity: 'high',
        message: `Page scrolls horizontally: scrollWidth=${scrollW} > clientWidth=${clientW} (diff ${scrollW - clientW}px)`
      });
    }

    // 2. Element-level overflow — elements whose right edge exceeds viewport
    const all = document.body.querySelectorAll('*');
    const offenders = [];
    all.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > vp.width + 1) {
        // Skip if parent has overflow:hidden/clip/auto/scroll (content is clipped, no real problem)
        let p = el.parentElement;
        let clipped = false;
        while (p && p !== document.documentElement) {
          const cs = getComputedStyle(p);
          if (['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflowX) || ['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflow)) {
            clipped = true; break;
          }
          p = p.parentElement;
        }
        if (!clipped) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : null,
            right: Math.round(r.right),
            text: (el.innerText || '').slice(0, 40).trim()
          });
        }
      }
    });
    if (offenders.length > 0) {
      // Keep unique-ish, top 10
      const seen = new Set();
      const unique = [];
      for (const o of offenders) {
        const k = `${o.tag}.${o.cls}`;
        if (seen.has(k)) continue;
        seen.add(k);
        unique.push(o);
        if (unique.length >= 10) break;
      }
      issues.push({
        type: 'element-overflow',
        severity: 'high',
        message: `${offenders.length} element(s) extend past viewport right edge (${vp.width}px). Top offenders: ` +
          unique.map(o => `<${o.tag}${o.id ? '#' + o.id : ''}${o.cls ? '.' + o.cls.split(' ')[0] : ''}> right=${o.right}`).join(' | ')
      });
    }

    // 3. Broken images
    const imgs = document.querySelectorAll('img');
    const broken = [];
    imgs.forEach(img => {
      if (!img.complete || img.naturalWidth === 0) {
        broken.push(img.src || img.getAttribute('src') || '(no src)');
      }
    });
    info.imageCount = imgs.length;
    if (broken.length > 0) {
      issues.push({
        type: 'broken-images',
        severity: 'medium',
        message: `${broken.length} broken image(s): ${broken.slice(0, 5).join(', ')}`
      });
    }

    // 4. Tap targets on mobile (< 40×40)
    if (vp.width <= 414) {
      const clickables = document.querySelectorAll('button, a');
      const tooSmall = [];
      clickables.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return; // hidden
        if (r.width < 40 || r.height < 40) {
          tooSmall.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 40) : '',
            w: Math.round(r.width),
            h: Math.round(r.height),
            text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 30).trim()
          });
        }
      });
      if (tooSmall.length > 0) {
        const unique = new Map();
        tooSmall.forEach(t => {
          const k = `${t.tag}.${t.cls}`;
          if (!unique.has(k)) unique.set(k, t);
        });
        issues.push({
          type: 'small-tap-targets',
          severity: 'medium',
          message: `${tooSmall.length} tap target(s) under 40×40px. Unique: ` +
            Array.from(unique.values()).slice(0, 8).map(t => `<${t.tag}.${t.cls.split(' ')[0]}> ${t.w}×${t.h} "${t.text}"`).join(' | ')
        });
      }
    }

    // 5. Anchor link validity
    const anchors = document.querySelectorAll('a[href^="#"]');
    const broken_anchors = [];
    anchors.forEach(a => {
      const href = a.getAttribute('href');
      if (href === '#' || href === '') return;
      const id = href.slice(1);
      if (!document.getElementById(id)) {
        broken_anchors.push(href);
      }
    });
    if (broken_anchors.length > 0) {
      const u = [...new Set(broken_anchors)];
      issues.push({
        type: 'broken-anchor-links',
        severity: 'high',
        message: `${u.length} unique href="#..." point to missing ids: ${u.slice(0, 10).join(', ')}`
      });
    }
    info.anchorCount = anchors.length;

    // 6. Sticky nav check
    const nav = document.querySelector('.nav');
    if (nav) {
      const nr = nav.getBoundingClientRect();
      info.navHeight = Math.round(nr.height);
      info.navTop = Math.round(nr.top);
    }

    return { issues, info };
  }, viewport);
}

// Scroll-hijack detection + sticky nav after scroll
async function scrollAudit(page, viewport) {
  const results = await page.evaluate(async (vp) => {
    const issues = [];
    const totalH = document.documentElement.scrollHeight;
    const step = Math.max(150, Math.floor(vp.height * 0.4));
    let y = 0;
    let lastActual = 0;
    let stuckAt = null;

    while (y < totalH - vp.height) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise(r => setTimeout(r, 80));
      const actual = window.scrollY;
      if (y > 100 && actual < lastActual + 10 && actual < y - 100) {
        stuckAt = { requested: y, actual: Math.round(actual) };
        break;
      }
      lastActual = actual;
      y += step;
    }

    // Scroll to 50% and verify nav is sticky (use instant to avoid smooth-scroll timing issues)
    window.scrollTo({ top: Math.floor(totalH / 2), behavior: 'instant' });
    await new Promise(r => setTimeout(r, 150));
    const nav = document.querySelector('.nav');
    let navInfo = null;
    if (nav) {
      const nr = nav.getBoundingClientRect();
      navInfo = { top: Math.round(nr.top), height: Math.round(nr.height) };
      if (Math.abs(nr.top) > 2) {
        issues.push({
          type: 'sticky-nav-failure',
          severity: 'high',
          message: `.nav not stuck to top after scrolling to 50% of page — top=${Math.round(nr.top)} (expected 0)`
        });
      }
    }

    // Scroll to bottom, verify we reached it (instant + wait for animation frame)
    window.scrollTo({ top: totalH, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 250));
    const reached = window.scrollY + vp.height;
    if (reached < totalH - 5) {
      issues.push({
        type: 'cannot-reach-bottom',
        severity: 'high',
        message: `Could not scroll to bottom of page — reached ${Math.round(reached)}px of ${totalH}px total`
      });
    }

    if (stuckAt) {
      issues.push({
        type: 'scroll-hijack',
        severity: 'high',
        message: `Scroll appears hijacked/stuck — requested y=${stuckAt.requested}, actual y=${stuckAt.actual}`
      });
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
    return { issues, totalH, navInfo, reached: Math.round(reached) };
  }, viewport);
  return results;
}

// Page-specific interaction tests
async function interactionTests(page, pageName, viewport) {
  const issues = [];
  const passes = [];

  try {
    if (pageName === 'homepage') {
      // Hamburger test (mobile only)
      if (viewport.width <= 900) {
        const hamburger = await page.$('#nav-hamburger');
        if (hamburger) {
          const visible = await hamburger.isVisible();
          if (!visible) {
            issues.push({ type: 'hamburger-hidden', severity: 'high', message: 'Hamburger button exists but is hidden at mobile viewport' });
          } else {
            await hamburger.click();
            await page.waitForTimeout(200);
            const menuOpen = await page.evaluate(() => document.getElementById('nav-mobile-menu')?.classList.contains('open'));
            if (!menuOpen) {
              issues.push({ type: 'hamburger-broken', severity: 'high', message: 'Clicking hamburger did not add .open class to mobile menu' });
            } else {
              passes.push('hamburger opens mobile menu');
              // close
              await hamburger.click();
              await page.waitForTimeout(100);
            }
          }
        }
      }

      // Video reel prev/next (desktop viewports only — reel may change on mobile)
      if (viewport.width > 900) {
        const reelNext = await page.$('#reel-next');
        if (reelNext) {
          const activeBefore = await page.evaluate(() => {
            const bars = document.querySelectorAll('.reel-bar');
            for (let i = 0; i < bars.length; i++) if (bars[i].classList.contains('active')) return i;
            return -1;
          });
          await reelNext.click();
          await page.waitForTimeout(300);
          const activeAfter = await page.evaluate(() => {
            const bars = document.querySelectorAll('.reel-bar');
            for (let i = 0; i < bars.length; i++) if (bars[i].classList.contains('active')) return i;
            return -1;
          });
          if (activeAfter === activeBefore) {
            issues.push({ type: 'reel-next-broken', severity: 'medium', message: `Video reel "next" button did not advance active bar (stayed at ${activeBefore})` });
          } else {
            passes.push(`reel next advances ${activeBefore}→${activeAfter}`);
          }
        }
        const reelPause = await page.$('#reel-pause');
        if (reelPause) {
          await reelPause.click();
          await page.waitForTimeout(150);
          const pauseHidden = await page.evaluate(() => {
            const p = document.getElementById('pause-icon');
            return p ? getComputedStyle(p).display === 'none' : null;
          });
          if (pauseHidden === false) {
            issues.push({ type: 'reel-pause-toggle-broken', severity: 'low', message: 'Reel pause button clicked but icons did not swap' });
          } else if (pauseHidden === true) {
            passes.push('reel pause toggles icon');
          }
          // resume
          await reelPause.click();
          await page.waitForTimeout(100);
        }
      }
    }

    if (pageName === 'topics') {
      // A-Z toggle
      const azToggle = await page.$('button[onclick*="toggle"], .view-toggle button, [data-view-toggle]');
      // fallback — search by text
      const anyToggle = await page.$$eval('button', btns => {
        const hit = btns.find(b => /A–Z|A-Z|alphabet/i.test(b.textContent || ''));
        return hit ? { text: hit.textContent.trim() } : null;
      });
      if (anyToggle) {
        passes.push(`A-Z toggle button found: "${anyToggle.text}"`);
      }
      // First category section anchor click
      const firstLink = await page.$('a[href="#section-cat1"]');
      if (firstLink) {
        await firstLink.click();
        await page.waitForTimeout(500);
        const y = await page.evaluate(() => window.scrollY);
        if (y < 50) {
          issues.push({ type: 'anchor-jump-broken', severity: 'medium', message: `Clicking #section-cat1 link did not scroll (y=${y})` });
        } else {
          passes.push(`#section-cat1 jump scrolled to y=${Math.round(y)}`);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    }

    if (pageName === 'adhd') {
      // Section link clicks — find side nav links
      const sectionIds = ['schools', 'family-qa', 'young-people', 'girls', 'medication', 'parenting', 'teachers'];
      let tested = 0, passed = 0;
      for (const id of sectionIds) {
        const target = await page.$('#' + id);
        if (!target) continue;
        const link = await page.$(`a[href="#${id}"]`);
        if (!link) continue;
        if (!(await link.isVisible())) continue;
        tested++;
        await link.click();
        await page.waitForTimeout(400);
        const landed = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          return Math.round(el.getBoundingClientRect().top);
        }, '#' + id);
        // After smooth scroll, target should be near top (within nav height + some buffer)
        if (landed !== null && landed >= -5 && landed < 200) {
          passed++;
        }
      }
      if (tested > 0) {
        passes.push(`adhd section jumps: ${passed}/${tested} land near viewport top`);
        if (passed < tested) {
          issues.push({
            type: 'section-jump-misalignment',
            severity: 'medium',
            message: `${tested - passed} of ${tested} adhd section links did not land near viewport top (check scroll-margin-top or nav offset)`
          });
        }
      }
    }
  } catch (err) {
    issues.push({ type: 'interaction-exception', severity: 'medium', message: `Interaction test threw: ${err.message}` });
  }

  return { issues, passes };
}

// ── Main ──
(async () => {
  const startTime = Date.now();
  const browser = await chromium.launch();
  const results = [];

  for (const pg of PAGES) {
    for (const vp of VIEWPORTS) {
      const key = `${pg.name}-${vp.name}`;
      console.log(`\n━━ ${key} (${vp.width}×${vp.height}) ━━`);

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1
      });
      const page = await context.newPage();

      const consoleMsgs = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          consoleMsgs.push({ type: msg.type(), text: msg.text().slice(0, 200) });
        }
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message.slice(0, 200));
      });

      const url = fileUrl(pg.file);
      let loadErr = null;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        // Give fonts a moment
        await page.waitForTimeout(600);
      } catch (e) {
        loadErr = e.message;
      }

      const result = {
        page: pg.name, file: pg.file,
        viewport: vp.name, width: vp.width, height: vp.height,
        loadError: loadErr,
        issues: [],
        passes: [],
        info: {},
        consoleMsgs: [...consoleMsgs],
        pageErrors: [...pageErrors]
      };

      if (!loadErr) {
        // Static checks
        const r1 = await runChecks(page, vp);
        result.issues.push(...r1.issues);
        result.info = r1.info;

        // Screenshot (above fold)
        await page.screenshot({ path: path.join(SHOTS, `${key}-fold.png`), fullPage: false });

        // Scroll + hijack
        const r2 = await scrollAudit(page, vp);
        result.issues.push(...r2.issues);
        result.info.totalScrollHeight = r2.totalH;

        // Full page screenshot
        await page.screenshot({ path: path.join(SHOTS, `${key}-full.png`), fullPage: true });

        // Interactions
        const r3 = await interactionTests(page, pg.name, vp);
        result.issues.push(...r3.issues);
        result.passes.push(...r3.passes);

        // Final console capture
        result.consoleMsgs = [...consoleMsgs];
        result.pageErrors = [...pageErrors];
      }

      // Summary line
      console.log(`  issues=${result.issues.length} passes=${result.passes.length} errors=${result.pageErrors.length} consoleMsgs=${result.consoleMsgs.length}`);
      for (const i of result.issues) {
        console.log(`    [${i.severity}] ${i.type}: ${i.message.slice(0, 150)}`);
      }

      results.push(result);
      await context.close();
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT, 'raw-results.json'), JSON.stringify(results, null, 2));
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Audit complete in ${elapsed}s. Results → audit-v8/raw-results.json`);
})().catch(err => {
  console.error('FATAL', err);
  process.exit(1);
});
