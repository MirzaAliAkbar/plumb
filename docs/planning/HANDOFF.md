# HANDOFF — LaunchPad Hacks 2026

Everything below was verified on 2026-11-22. Nothing here is a projection.

---

## The deliverable

| | |
|---|---|
| **Live app** | https://plumb-akw.pages.dev |
| **Source** | https://github.com/MirzaAliAkbar/plumb (GPL-3.0-or-later) |
| **Devpost copy** | `SUBMISSION.md` — paste-ready |
| **Demo script** | `DEMO_VIDEO.md` — shot by shot, 90–150s |
| **Deadline** | **Dec 4, 2026, 5:00 PM EST** |

**What it is.** Drop a PDF; Plumb reconstructs the real reading order from page
geometry and exports semantic HTML that a screen reader can navigate. No account,
no upload, no key, works offline after first load.

---

## Verified state

| Check | Result |
|---|---|
| Unit tests | **85 passed** |
| End-to-end tests | **19 passed** (incl. axe WCAG 2.2 AA + real offline) |
| Lint | **0 warnings** |
| Typecheck | clean |
| Production build | main 448 KB / 135 KB gzip; pdf.js 499 KB / 152 KB gzip (own chunk); offline read-aloud fallback 1.73 MB / 600 KB gzip (lazy, precached) |
| Cold load | **~0.3–1.0 s load**, **~0.5–1.1 s to heading**, **~296 KB transferred gzipped** (main + pdf.js + CSS); the service worker then precaches the worker, fonts and the read-aloud fallback in the background |
| CI on GitHub | **green**, all 7 steps confirmed to have run |
| Live E2E | run against the deployed URL after each release; the local suite is green |
| axe violations | **0** on landing and reading view |
| Design audit | PASS across 5 states / 2 breakpoints |

### Measured on real papers (144 pages, 6 arXiv papers)

| Metric | Result |
|---|---|
| Mean reading-order confidence | **89.5%** |
| Clean text extraction | **6/6 documents** |
| Low-confidence blocks | **2.9%** mean |
| Running headers/footers suppressed | 47 lines |
| Real headings emitted | **180**, with **0 skipped levels** |
| Analysed speed | 48-page paper in **3.3 s**, entirely client-side |

Reproduce: `node tools/fetch-corpus.mjs && npx tsx tools/accuracy.mts && npx tsx tools/structure.mts`

---

## What is genuinely strong

1. **An uncontested lane.** 0 of 40 competitors touched PDF reading order
   (`research/FIELD_INTEL.md`). Only 10/40 mention accessibility at all.
2. **A real mechanism, not a wrapper.** Character-density gutter detection with
   banded sequencing. The naive approach is documented as failing, and why.
3. **Numbers a judge can re-run.** The accuracy and structure harnesses are in the
   repo and in CI. This is the rarest signal in the field — 3/40 did real research,
   7/40 cited anything.
4. **The accessibility is the product**, not a checkbox on the marketing page.

---

## What is honestly weak — read this before submitting

1. **No user study.** We have not tested with blind students. The submission says
   so plainly rather than implying otherwise. This is the largest gap against a
   genuine 5 on Usefulness & Impact.
2. **One and two columns only.** Three-column journals are refused, not handled.
3. **No OCR.** Scanned PDFs are detected and refused with a message.
4. **Author names on a title page are classified as headings.** Cosmetic, visible
   in the export outline, not worth a risky fix at this stage.
5. **The demo video does not exist yet.** The script does. Recording it is yours.

---

## What you must do (I cannot)

| # | Task | Time |
|---|---|---|
| 1 | **Record the demo video** using `DEMO_VIDEO.md` | ~1 h |
| 2 | **Submit on Devpost** — paste `SUBMISSION.md`, upload video + `docs/screenshots/*.png` | ~20 min |
| 3 | Skim `SUBMISSION.md` for voice — it should sound like you | ~10 min |
| 4 | Optional: test with a real screen reader (NVDA/VoiceOver) and add one sentence | ~20 min |

The screenshots in `docs/screenshots/` are committed and ready to upload.

---

## If something breaks

```bash
cd app
npm install
npm test            # 85 unit
npm run build       # typecheck + bundle
npx playwright test # 19 E2E incl. axe + offline
npm run deploy      # rebuild + push to Cloudflare Pages
```

The deploy needs `wrangler` authenticated (`wrangler whoami`). If Cloudflare is
unavailable, `dist/` is a plain static folder — it will run on Netlify, Vercel, or
GitHub Pages unchanged (`base: './'`).

---

## The one-line pitch

> Plumb repairs the reading order of inaccessible PDFs in the browser, so screen
> readers stop reading two-column papers across the gutter.

---

## Reading order for the docs

`MASTERPLAN.md` (strategy) → `DECISIONS.md` (why each fork) → `DEBATE.md` (how the
idea won) → `EVIDENCE.md` (every citation, verified) → `SUBMISSION.md` (the copy).
