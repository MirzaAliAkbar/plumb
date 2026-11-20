# Plumb

**Screen readers read PDFs in the wrong order. Plumb fixes it — in your browser.**

Most PDFs carry no structure: no headings, no paragraphs, no reading order. A screen
reader can only follow the order the file happens to store. In a two-column paper that
order interleaves the columns, so a blind student hears the left column and the right
column alternating sentence by sentence.

Plumb reconstructs the real reading order from the page geometry, shows you exactly what
it decided, and hands back a clean semantic HTML copy you can keep and open in your own
screen reader.

It runs entirely on your device, and works offline after the first load. No
account, no upload, no API key, no server.

**Live: https://plumb-akw.pages.dev**

---

## Run it

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build && npm run preview
```

## What it does

1. **Extract** — every text run is pulled out with its exact page position, using pdf.js
   in the browser.
2. **Reconstruct** — runs are clustered into lines, lines are segmented into bands and
   columns, repeated headers and footers are removed, and blocks are sequenced.
3. **Show** — a numbered overlay on the page makes the inferred order visible so it can
   be audited.
4. **Read** — a reflowed reading view with synchronised text-to-speech.
5. **Export** — semantic HTML: real `<h2>`, `<p>`, `<ul>`, `<figcaption>`. The durable
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

## Honest limitations

These are real, and they are stated rather than hidden:

- **Scanned documents are not supported.** There is no OCR. The app detects this and
  tells you instead of returning garbage.
- **Three-column layouts** are not handled. Two columns and single columns are.
- **Complex tables** are not reconstructed as tables. Their text is sequenced as text.
- **Mathematics** is not spoken correctly. Use a dedicated math tool for that.
- **Right-to-left scripts** are not handled.
- **Text over background images** and unusual font encodings can lose runs.

Where the pipeline is unsure, it says so — per block, with a confidence figure — rather
than guessing silently. For an accessibility tool, a visible "I am not sure" is worth more
than a confident wrong answer.

## Tests

```bash
npm test              # 58 unit tests on the pipeline and the HTML export
npx playwright test   # 10 end-to-end, incl. axe WCAG 2.2 AA + real offline
```

The pipeline is a pure function of extracted geometry, which is why it can be unit-tested
without a browser or a PDF.

## Tech

React 19 · TypeScript · Vite 8 · pdf.js · hand-written CSS (no UI framework) · Vitest ·
Playwright + axe-core.

## Deploy

Static build, deployed to Cloudflare Pages:

```bash
npm run deploy
```

## Licence

MIT. See [LICENSE](LICENSE).
