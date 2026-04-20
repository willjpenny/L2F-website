# V8 Mockup Audit — Full Report

**Date:** 2026-04-16
**Pages audited:** [homepage-v8.html](../homepage-v8.html), [topics-v8.html](../topics-v8.html), [adhd-v8.html](../adhd-v8.html)
**Viewports:** 7 sizes from 1920×1080 down to 375×667
**Method:** Playwright headless Chromium — 21 combinations × automated checks + 45 screenshots total.

---

## 1. Critical issues

**None.** No broken JavaScript, no page errors, no console errors, no horizontal scroll, no scroll hijacking, no broken anchor links, no missing images. All three pages load cleanly at every viewport.

---

## 2. High-severity issues

**None.** All automated checks passed after accounting for `scroll-behavior: smooth` (the initial run's `cannot-reach-bottom` false positives were from measuring scroll position mid-animation).

---

## 3. Medium-severity issues

### 3.1 Mobile tap targets below 40×40px (all three pages, all mobile viewports)

Apple/WCAG recommend a minimum 44×44 touch target. Current undersized elements on ≤414px viewports:

**Homepage** (18 offenders):
| Element | Size | Notes |
|---|---|---|
| `button.nav-hamburger` | 36×36 | Also on topics/adhd |
| `button.reel-nav` (prev/next) | 36×36 | Over video — easy to mis-tap |
| `button.reel-pause` | 32×32 | Smallest on the page |
| `a.clip-watch` | 152×40 | 40px height — borderline |
| `a.btn-spotify` / `a.btn-apple` | 110×40 | Also 40 height |

**Topics** (10 offenders):
| Element | Size | Notes |
|---|---|---|
| `button.nav-hamburger` | 36×36 | |
| `button[active]` "By category" | 110×32 | |
| `button` "A–Z" | 58×32 | |
| `a` "Topics" (nav link) | 44×17 | 17px height is very tight |

**ADHD** (38 offenders — the most):
| Element | Size | Notes |
|---|---|---|
| `button.nav-hamburger` | 36×36 | |
| `a` "Home" (breadcrumb) | 36×21 | |
| `a.btn-podcast-inline` "Spotify" | 82×28 | Per-section Spotify pills |
| `a.btn-podcast-inline` "Apple" | 74×28 | |
| `a.btn-download-inline` "Summary PDF" | 120×28 | Per-section download |
| `button.btn-view-all` | 145×32 | Plus 32 more similar pills across 7 sections |

**Recommendation:** bump to `min-height: 44px` with padding to match; for the hamburger + reel controls, 40×40 is enough if you ship an explicit 44×44 hitbox via padding.

### 3.2 Topics category tab-bar overflow is silent (tablet + mobile)

`.cat-nav-inner` uses `overflow-x: auto; scrollbar-width: none` — tabs scroll horizontally, but on 768px tablet the last tab ("Services & Support") is fully clipped off the right edge with **no visual affordance** (no fade gradient, no arrow). Users have no reason to suspect there are more tabs. See `topics-tablet-fold.png` — "Child Development" is cut mid-text, "Services & Support" is completely invisible.

Same behaviour at mobile-md (390px): only "Neurodiversity", "Mental Health", and partial "Eating & Di…" visible.

**Recommendation:** add a right-edge fade mask + small chevron indicator, or reduce tab padding + font so six pills fit on tablet.

### 3.3 Topics "N topics" count wraps awkwardly on mobile

At narrow viewports (390px and below), `.category-count` wraps independently of the number. Seen in `topics-mobile-md-fold.png`:

```
Neurodiversity (ADHD & Autism) 4
topics
```

The "4" sits orphaned at the end of the title line, "topics" drops to line 2. Root cause: literal space between digit and "topics" in [topics-v8.html:230](../topics-v8.html) and siblings — the span allows a break there.

**Recommendation:** wrap `"4 topics"` in `<span class="category-count" style="white-space: nowrap">` OR use a non-breaking space (`&nbsp;`). Two-line wrap on mobile is fine; the orphan number is not.

### 3.4 Homepage video reel "Now playing" badge overlaps quote (mobile)

On mobile viewports (414, 390, 375), the `.reel-now-playing` badge at the video's top-right sits directly on top of the quote text "What does an ADHD diagnosis actually mean for my child's future?". See `homepage-mobile-md-fold.png`.

**Recommendation:** either move the badge above the video (margin-bottom on the caption), or hide the badge at ≤600px.

---

## 4. Content inconsistency

### 4.1 Homepage says "29 topics" in hero, but "31 topics" everywhere else

- Hero sub-line ([homepage-v8.html](../homepage-v8.html)): *"covering 29 health and development topics"*
- Stats row: "31 topics"
- Bottom CTA: "Browse all 31 topics"
- Topics page subhead: "covering 31 health and development topics"
- Sum of the six category counts (4+7+3+7+3+7) = 31 ✓

The hero line is the outlier. Update homepage hero to 31.

---

## 5. Low-severity / cosmetic

Nothing else flagged by automation or visual review. Layouts align cleanly at every desktop resolution (1920 / 1440 / 1366). Tablet (768px) and all three mobile viewports degrade gracefully with hero stacks, single-column card layouts, and working horizontal scroll where appropriate.

---

## 6. Interactive element test results

| Test | Result |
|---|---|
| Homepage hamburger opens mobile menu (all mobile viewports) | ✅ PASS |
| Homepage video reel "next" advances active bar (0→1) | ✅ PASS |
| Homepage video reel "pause" toggles icon visibility | ✅ PASS |
| Topics A-Z toggle button present + functional | ✅ PASS |
| Topics category anchor `#section-cat1` scrolls correctly | ✅ PASS |
| ADHD 7 side-nav section links land near viewport top | ✅ 7/7 PASS |
| Sticky `.nav` stays at top through full-page scroll | ✅ PASS (all pages, all viewports) |
| Full page scrollable to bottom | ✅ PASS (all pages, all viewports) |
| Scroll hijack detection | ✅ CLEAN (no section traps wheel events) |
| Anchor link validity (all `href="#..."` resolve) | ✅ CLEAN (all three pages) |
| Image load | ✅ No broken images (note: homepage + topics have no `<img>` tags; adhd uses CSS-only thumbnails) |
| Console + page errors | ✅ ZERO across all 21 runs |

---

## 7. Page dimensions at each viewport

Sanity data for reference:

| Page | Viewport | Width | Page height |
|---|---|---|---|
| homepage | desktop-xl | 1920 | 2426 |
| homepage | desktop-lg | 1440 | 2282 |
| homepage | desktop-md | 1366 | 2194 |
| homepage | tablet | 768 | 2980 |
| homepage | mobile-md | 390 | 3519 |
| topics | desktop-xl | 1920 | 3886 |
| topics | desktop-lg | 1440 | 3886 |
| topics | desktop-md | 1366 | 3886 |
| topics | tablet | 768 | 5608 |
| topics | mobile-md | 390 | 8645 |
| adhd | desktop-xl | 1920 | 5265 |
| adhd | desktop-lg | 1440 | 5265 |
| adhd | desktop-md | 1366 | 5239 |
| adhd | tablet | 768 | 6721 |
| adhd | mobile-md | 390 | 8258 |

Horizontal: `scrollWidth === clientWidth` at every single row — zero overflow anywhere.

---

## 8. Screenshot index

All screenshots live in `audit-v8/screenshots/`. Naming: `{page}-{viewport}-{fold|full}.png`.

### Worth glancing at first
- `topics-tablet-fold.png` — shows the clipped category tabs (§3.2)
- `topics-mobile-md-fold.png` — shows the orphan "4/topics" wrap (§3.3)
- `homepage-mobile-md-fold.png` — shows "Now playing" badge overlapping quote (§3.4)
- `topics-desktop-lg-az-fold.png` — A-Z view confirmed working
- `homepage-mobile-md-menu-open.png` — mobile nav drawer confirmed working
- `homepage-desktop-md-midscroll.png` — sticky nav confirmed working at 50% scroll

### Full catalogue
21 × `-fold.png` (viewport-only) + 21 × `-full.png` (full page) + 3 extra states:
- `topics-desktop-lg-az-{fold,full}.png`
- `topics-mobile-md-az-{fold,full}.png`
- `homepage-mobile-md-menu-open.png`
- `homepage-desktop-md-midscroll.png`

---

## 9. Summary

**Bottom line:** the v8 mockup is structurally solid. No critical or high-severity bugs. The four medium issues above (tap targets, silent tab overflow, topic-count wrap, Now-playing badge overlap) plus the 29-vs-31 content drift are the entire actionable list.
