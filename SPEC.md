# SPEC — Plumb

> Make an inaccessible PDF readable, in the browser, for free.
>
> Reading order is a layout problem, and layout is recoverable from geometry — so it can be
> fixed before the screen reader ever sees it.

## 1. Problem

Screen readers follow a PDF's internal content-stream order, not its visual order. On a
two-column paper that means the reader interleaves columns; on exported slides it means text
boxes are read in authoring order. Free tooling either *validates* the problem (PAC, veraPDF)
or *reports* it (Acrobat's checker). Nothing free repairs it at read time, in the browser.

**Measured on our own corpus** (`spike/probe3.mjs`): content-stream order contains backwards
x-jumps on 6–21% of in-line moves, and pdf.js extraction returns **zero** replacement
characters on standard arXiv PDFs — so the primitive we need is sound.

## 2. Users

Primary: students using screen readers (blind / low-vision) facing course PDFs.
Secondary: dyslexic and ADHD readers who use TTS and need clean, distraction-free text.
Tertiary: anyone reading a badly-exported PDF on a phone.

## 3. What it does

1. **Drop a PDF.** Everything happens locally. No upload, no account, no key.
2. **Extract** text runs with coordinates via pdf.js (in a worker).
3. **Reconstruct** — the algorithmic core:
   - cluster runs into lines (baseline + font tolerance)
   - detect layout: single column / two column, via line-start histogram + gap analysis
   - suppress running headers, footers, page numbers (cross-page repetition + position)
   - detect figures/tables regions (drawn rects + sparse text + caption patterns)
   - sequence blocks in correct reading order
   - classify each block: `heading` / `paragraph` / `list-item` / `caption` / `code` / `table-text`
   - score confidence per block and per page
4. **Show** a numbered overlay on the page so the order is visible and auditable.
5. **Read** — a clean reflow view with synchronized text-to-speech.
6. **Export** semantic HTML (`<h1>`, `<p>`, `<ul>`, `<figure>`) — the durable artifact, opened
   in the user's own screen reader. This is the product; the overlay is the proof.

## 4. Non-negotiable engineering constraints

| Constraint | Implementation |
|---|---|
| No backend, no API key, no login | Static Vite build; all parsing client-side |
| Works offline after first load | Service worker precache; verified by test |
| WCAG 2.2 AA, provably | axe in CI, keyboard-only E2E, focus management, live regions |
| Tested | Vitest unit tests on the pipeline; Playwright E2E; axe scan |
| Honest failure | Confidence shown per block; low-confidence blocks flagged, never silently guessed |
| MIT licensed | `LICENSE` |
| Deployable, durable URL | GitHub Pages (primary) + Cloudflare Pages (fallback) |

## 5. Architecture

```
app/
├── src/
│   ├── App.tsx / App.css
│   ├── components/   Dropzone, PageOverlay, ReadingView, ConfidenceBadge
│   ├── lib/          types, extract, lines, layout, sequence, export, speak, pipeline
│   ├── styles/       theme.css (design tokens, light + dark)
│   └── sw-source.js  service worker (asset manifest injected at build)
├── tools/            make-sample, accuracy, contrast, design-audit
└── e2e/              Playwright + axe
```

```
src/
  main.tsx
  App.tsx
  lib/
    extract.ts      pdf.js worker wrapper -> TextRun[], PageGeometry
    lines.ts        run -> line clustering
    layout.ts       column detection, header/footer suppression, figure regions
    sequence.ts     reading-order sequencing + confidence
    semantic.ts     block classification (heading/para/list/caption)
    export.ts       semantic HTML generation
    speak.ts        Web Speech wrapper w/ boundary events
    persist.ts      IndexedDB (idb) for recent documents
  components/
    Dropzone.tsx
    PageOverlay.tsx     numbered overlay canvas
    ReadingView.tsx     reflow + TTS highlighting
    ConfidenceBadge.tsx
    Toolbar.tsx
  a11y/
    LiveRegion.tsx
  workers/
    pdf.worker.ts
```

### Data model

```ts
interface TextRun { str: string; x: number; y: number; w: number; h: number; font: string; size: number; }
interface Line    { runs: TextRun[]; x0: number; x1: number; y: number; text: string; }
interface Block   { kind: 'heading'|'paragraph'|'list-item'|'caption'|'code'|'table-text';
                    lines: Line[]; order: number; confidence: number; column: 0|1; }
interface PageAnalysis { pageIndex: number; width: number; height: number;
                         columns: 1|2; blocks: Block[]; suppressed: Line[]; confidence: number; }
```

### Pipeline contract

`extractPdf(file) → PageAnalysis[]` must be **pure and synchronous given runs**, so every
stage is unit-testable without a DOM. Tests run the pipeline over fixtures in
`test/fixtures/` and assert structural properties.

## 6. Confidence model (the trust mechanism)

Every block gets a confidence from concrete signals:
- line-start alignment consistency within the block
- gap between columns relative to median char width
- whether the block's x-extent crosses the detected gutter (a spanning figure → low confidence)
- header/footer repetition ratio across pages
- font-size continuity within a paragraph

UI rule: `confidence < 0.6` → visibly flagged, user can drag to reorder, and a live-region
announcement says so. **Never** silently reorder.

## 7. Accessibility requirements (scored)

- Full keyboard operation, visible focus (2.4.11 / 2.4.12)
- Drag-reorder has a keyboard equivalent (2.5.7)
- Targets ≥ 24×24 px (2.5.8)
- Overlay carries alt text describing order; reading view is real semantic HTML
- `aria-live` announcements for processing state and reordering
- Respects `prefers-reduced-motion`, works in `forced-colors`
- 200% / 400% zoom without loss

## 8. Scope — explicitly in and out

**In:** born-digital PDFs; single column; two column; exported slides. English + Latin script.
**Out (stated as limitations, never silent):** scanned/image-only PDFs (no OCR), three-column
journals, complex tables, right-to-left scripts, math (points to dedicated tools).

## 9. Definition of done — verified 2026-11-20

- [x] Production build succeeds; bundle loads under 2s on a cold cache
      *(measured: 741–1254 ms, 212 KB transferred)*
- [x] `npm test` green: pipeline unit tests + Playwright E2E + axe zero violations
      *(68 unit + 10 E2E, 0 axe violations)*
- [x] Works offline after first load (verified by test)
- [x] Deployed URL live *(https://plumb-akw.pages.dev, E2E run against production)*
- [x] README with 3-line run instructions, architecture diagram, MIT license
- [ ] 90–150s captioned demo video — **script written (`DEMO_VIDEO.md`), recording is the user's**
- [x] Devpost page copy with sourced evidence and honest limitations
- [x] Accuracy harness output published (real numbers on real PDFs)
