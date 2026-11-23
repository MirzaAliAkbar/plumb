# Plumb

**Screen readers read PDFs in the wrong order. Plumb fixes it in your browser.**

Most PDFs carry no structure: no headings, no paragraphs, no reading order. A screen
reader can only follow the order the file happens to store. In a two-column paper that
order interleaves the columns, so a blind student hears the left column and the right
column alternating sentence by sentence.

Plumb reconstructs the real reading order from the page geometry, shows you what it
decided, and hands back semantic HTML you can open in your own screen reader.

It runs entirely on your device and works offline after the first load. No account, no
upload, no API key, no server.

**Live: https://plumb-akw.pages.dev**

---

## Architecture

```
                       ┌─────────────────────────────────────────┐
  PDF file (local) ───▶│  extract.ts — pdf.js in a web worker    │
                       │  every text run + its page position     │
                       └────────────────────┬────────────────────┘
                                            │ TextRun[]
                       ┌────────────────────▼────────────────────┐
                       │  lines.ts — cluster runs onto baselines │
                       │  split on gaps wider than 1.2em         │
                       └────────────────────┬────────────────────┘
                                            │ Line[]
                       ┌────────────────────▼────────────────────┐
                       │  layout.ts — density profile → gutter   │
                       │  columns, spanning lines, running       │
                       │  headers/footers suppressed             │
                       └────────────────────┬────────────────────┘
                                            │ LayoutInfo
                       ┌────────────────────▼────────────────────┐
                       │  sequence.ts — band the page, order it, │
                       │  group into blocks, classify, score     │
                       └────────────────────┬────────────────────┘
                                            │ Block[]
              ┌─────────────────────────────┼─────────────────────────────┐
              ▼                             ▼                             ▼
      ┌───────────────┐           ┌─────────────────┐          ┌──────────────────┐
      │ PageOverlay   │           │  ReadingView    │          │  export.ts       │
      │ numbered,     │           │  reflow + TTS   │          │  semantic HTML   │
      │ auditable     │           │                 │          │  ← the artifact  │
      └───────────────┘           └─────────────────┘          └──────────────────┘
```

Everything after `extract` is a pure function of extracted geometry, which is why
the whole pipeline is unit-testable without a browser or a PDF.

## Run it

```bash
npm install
cp .env.example .env.local   # paste your Clerk publishable key
npm run dev
```

Production build:

```bash
npm run build && npm run preview
```

## Routes

| Route | What | Auth |
| :-- | :-- | :-- |
| `/` | The argument, and a link into the tool | public |
| `/app` | The tool: drop a PDF, inspect, export | public |
| `/library` | Documents you have analysed | required |
| `/sign-in`, `/sign-up` | Clerk | public |

The tool works without an account; only the library needs one.

## What it does

1. **Extract**: every text run is pulled out with its exact page position, using pdf.js
   in the browser.
2. **Reconstruct**: runs are clustered into lines, lines are segmented into bands and
   columns, repeated headers and footers are removed, and blocks are sequenced.
3. **Show**: a numbered overlay on the real page, plus a before/after view that puts the
   stored order beside the repaired one.
4. **Read**: a reflowed reading view with synchronised text-to-speech.
5. **Export**: semantic HTML with real `<h2>`, `<p>`, `<ul>`, `<figcaption>`. The durable
   artifact, opened in whatever assistive technology you already use.

## Why the geometry approach

The naive way to find columns is to look for a vertical band of the page that no text
touches. That fails on precisely the documents that matter most: a full-width title, a
spanning figure, or a table row crosses the gutter, so the gutter is never empty and the
page is misread as a single column.

Plumb instead builds a character-density profile across the page width and finds the
*thinnest* vertical slice relative to the density either side of it. Lines are then
classified as left, right, or **spanning**, and the page is split into horizontal *bands*
at every spanning line. Within a band the order is left column then right column; across
bands it is top to bottom. That is what makes a title land before both columns and a
caption stay with its figure.

## Limitations

- **Scanned documents are not supported.** There is no OCR. The app detects this and
  tells you instead of returning garbage.
- **Three-column layouts** are not handled. Two columns and single columns are.
- **Complex tables** are not reconstructed as tables. Their text is sequenced as text.
- **Mathematics** is not spoken correctly. Use a dedicated math tool for that.
- **Right-to-left scripts** are not handled.
- **Text over background images** and unusual font encodings can lose runs.

Where the pipeline is unsure, it says so per block, with a confidence figure, instead of
guessing silently. A visible "I am not sure" is more useful than a confident wrong answer.

## Tests

```bash
npm test              # 85 unit tests on the pipeline, export, errors and storage
npx playwright test   # 19 end-to-end, incl. axe WCAG 2.2 AA + real offline
```

The pipeline is a pure function of extracted geometry, which is why it can be unit-tested
without a browser or a PDF. The end-to-end suite includes a genuine offline test: it lets
the service worker install, cuts the network, reloads, and analyses a PDF. That only
passes because pdf.js's worker and font data are precached — they load lazily on first
use, so on-demand caching would leave the shell working and extraction broken.

## Tech

React 19 · TypeScript · Vite 8 · pdf.js · Clerk · hand-written CSS (no UI framework) ·
Vitest · Playwright + axe-core.

## Deploy

Static build, deployed to Cloudflare Pages:

```bash
npm run deploy
```

## Licence

GPL-3.0-or-later. See [LICENSE](../LICENSE). The offline read-aloud fallback uses eSpeak via
`mespeak`, which is GPL-3.0, so the project is GPL to comply with that license.
