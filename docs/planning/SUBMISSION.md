# SUBMISSION: Devpost copy

---

## Project name

**Plumb**

---

## Elevator pitch (the one-liner used in the tagline field)

> Plumb repairs the reading order of inaccessible PDFs in the browser, so screen
> readers stop reading two-column papers across the gutter.

---

## Inspiration

A PDF usually carries no structure. No headings, no paragraphs, no reading order.
A screen reader can only follow the order the file happens to store. In a
two-column paper, that order interleaves the columns. The reader hears the left
column and the right column alternating, sentence by sentence.

**71.6% of screen reader users navigate by jumping between headings** (WebAIM
Screen Reader User Survey #10). A document with no heading structure gives them
nothing to jump to.

**21% of US undergraduates report a disability** (NCES), but only **8% register
with their institution's disability office** (PNPI, citing NCES). Most of the
students outside that 8% never reach the office that provides licensed assistive
software. A free browser tool can reach them without a registration step.

The tools we compared mostly do one of two things. Acrobat Pro, PAC and veraPDF
diagnose the problem and tell you that tags are missing. Kurzweil and Read&Write
provide reading support, usually through an institutional licence that a student
reaches after registering with disability services. Read-aloud tools that follow
the PDF's own order speak the words as stored, so the sequence stays broken.
Plumb repairs the sequence in the browser, for free.

---

## What it does

Drop a PDF. Plumb:

1. **Extracts** every text run with its exact page position, locally, using
   pdf.js, and nothing is uploaded.
2. **Reconstructs** the reading order from geometry: clustering runs into lines,
   detecting columns from density, removing repeated headers and footers, and
   sequencing blocks into bands.
3. **Shows you what it decided**: a numbered overlay drawn on the real page,
   colour- and pattern-coded by confidence, plus a before/after view that puts
   the stored order beside the repaired one.
4. **Read** the result in a clean, reflowed view with synchronised text-to-speech — using an
   offline eSpeak fallback when the device has no system voice.
5. **Exports** semantic HTML with real `<h2>`, `<p>`, `<ul>`, `<figcaption>`, as a
   file you keep and open in your own screen reader.

No account needed. No API key. No server. Works offline after first load.

---

## How we built it

Deciding the order was the hard part.

The obvious way to find columns is to look for a vertical band of the page that
no text touches. That breaks on the documents that matter: a full-width title, a
spanning figure, or a wide table row crosses the gutter, so the band is never
empty and the page reads as a single column. On our first sample, the title
covered the gutter and the two-column page was detected as one column.

The layout detector builds a **character-density profile** across the page width
and finds the thinnest vertical slice relative to the density on either side.
Lines are classified as left, right, or **spanning**, and the page is split into
horizontal **bands** at every spanning line. Within a band the order is left
column then right column; across bands it is top to bottom.

That is what puts a title before both columns, keeps a caption with its figure,
and stops a paragraph interleaving with the column beside it.

Each block carries a confidence score built from the gutter quality, whether the
block straddles the gutter, whether its left edges agree, and whether font sizes
change mid-paragraph. Below 60% the block is flagged in the overlay and in the
export. A page where no gutter was found does not get full marks, because "I found
no columns" and "I am sure there are none" are different results.

The export also has to carry real heading structure, because that is how the
71.6% navigate. Across the six-paper corpus, `tools/structure.mts` counts **180
real `<h2>`/`<h3>` elements with zero skipped levels**, nested as the papers nest
them ("3.1. Residual Learning" under "3. Deep Residual Learning"). Two bugs stood
in the way. A numbered section heading was absorbed into the paragraph above it,
and "1. Introduction" matched the ordered-list pattern, so sections were exported
as bullets. The classifier now judges a line before merging it and uses
capitalisation to tell a section title from a list item.

**Stack:** React 19, TypeScript, Vite 8, pdf.js. Hand-written CSS with no UI
framework, so every focus state, contrast ratio and target size is ours. Vitest
for the pipeline; Playwright and axe-core for end-to-end and accessibility.

Everything after extraction is a pure function of the geometry, so the pipeline
can be tested without a browser or a PDF.

---

## Challenges we ran into

1. **Naive column detection failed on our own sample.** We built the sample PDF
   before the algorithm, so the failure was visible rather than hypothetical.

2. **pdf.js returns content-stream order**, which is the thing we are trying to
   correct. Line clustering had to ignore that order: runs on the same baseline
   in different columns sit next to each other in the stream and must be split by
   horizontal gap. Our first threshold was 1.8em, wider than the 16pt gutter in a
   dense two-column paper, so the columns merged into page-wide lines and every
   line looked like a spanning title. It is 1.2em now, and a page of CLIP went
   from 12 false spanning lines to 0.

3. **Confidence was initially constant.** The first version returned 100% on
   every single-column page and flagged nothing across 144 pages of real papers.
   We rewrote it to score from the signals above; it now ranges from 79–97% per
   document, with 0–10% of blocks flagged.

4. **A heading that was not a heading, and a heading that was a bullet.** Near-body
   section headings merged into the paragraph above, and "1. Introduction" was
   exported as a `<li>`. Both cost the document its outline. We found them by
   auditing the structure of the export rather than its text.

5. **Accessibility bugs that automated tools caught.** axe found a
   nested-interactive control (a file input inside a `role="button"` container), a
   form field with no label, and `--ink-400` at 3.58:1 contrast. All three are
   fixed, and the scan runs in CI.

6. **Our contrast audit was wrong.** It kept a duplicate copy of the palette that
   drifted from the stylesheet, so it reported a failure on a colour the app no
   longer used and would have passed a bad one for the same reason. It now parses
   the tokens from the CSS, and we tested that it still fails when it should.

---

## Accomplishments that we're proud of

- **A real geometric algorithm, not a wrapper.** Reading order is reconstructed from a
  character-density profile and spanning-line bands. No model calls, no API keys, no server.
- **It actually works offline.** The service worker precaches 24 assets (app shell, pdf.js
  worker, font data, read-aloud fallback). A real Playwright test cuts the network, reloads,
  and still analyses a PDF.
- **Accessibility is the product, not a checkbox.** axe-core reports zero WCAG 2.2 A/AA
  violations on the landing page and reading view, enforced in CI; every text pair meets AA
  contrast; the whole tool is keyboard-operable; confidence is never signalled by colour alone.
- **Measured, reproducible accuracy.** A checked-in harness runs the pipeline over six real
  arXiv papers (144 pages): **89.5% mean reading-order confidence**, **180 real `<h2>`/`<h3>`
  elements with zero skipped levels**, **47 running headers/footers suppressed**, and a
  48-page paper analysed in **3.3 s**.
- **85 unit tests and 19 end-to-end tests**, including a genuine offline test and an axe scan,
  green in CI.
- **Zero-friction and private.** No account needed, no upload, no API key, no backend. The file
  and the full analysis never leave the device.
- **A durable artifact.** The export is semantic HTML with real headings, paragraphs and lists —
  a file the user keeps and opens in their own screen reader.
- **Free and open source.** GPL-3.0-or-later, with a clean README and a live deployment.

### Accessibility is the product, not a checkbox

- **axe-core: zero violations** against WCAG 2.2 A/AA on the landing page and the reading view.
- **Every text pair meets AA contrast**, computed rather than eyeballed (`tools/contrast.mjs`).
- **Full keyboard operation**: overlay blocks are focusable, the tool works without a mouse, and
  focus rings are visible on every control.
- **Confidence is never signalled by colour alone**: border style (solid, dashed, dotted) and a
  text label carry the same information, including in forced-colours mode.
- **Semantic HTML throughout**: the reading view emits real headings, lists and figure captions.
- Respects `prefers-reduced-motion` and `forced-colors`; no horizontal overflow at 200% zoom or
  at 390px.

---

## What we learned

- **A confident wrong answer is worse than a visible "I am not sure".** A
  screen-reader user cannot glance at the page to check the order, so the
  uncertainty display matters as much as the algorithm.
- **Measure the claim or drop it.** We wrote a corpus harness that runs the
  pipeline over real papers and prints the numbers. Every figure here comes from
  it or from a named source; we removed two statistics we could not verify.
- **The obvious citation can be stale.** The ADA Title II dates quoted everywhere
  (April 2026) were extended to April 2027/2028 by an Interim Final Rule in April
  2026.

---

## What's next for Plumb

- **A real user study.** We have not yet measured outcomes with blind or low-vision students.
  That is the biggest gap and the first thing we would do next.
- **Ground-truth accuracy, not just confidence.** Compare the repaired order against
  human-ordered PDFs (precision/recall), so the headline number is measured correctness rather
  than a self-reported score.
- **OCR for scanned PDFs.** Today scans are detected and refused; next we would add OCR so the
  same pipeline can repair them.
- **Three-column layouts.** One and two columns work; three-column journals need a different
  banding model.
- **Real tables.** Detect table regions and export real `<table>` markup instead of sequencing
  the text.
- **Math.** Export MathML (or ASCIIMath) so equations are navigable rather than flattened.
- **Right-to-left scripts** and **text over background images**.
- **More durable formats.** Tagged PDF and EPUB export alongside HTML.
- **Installable PWA polish** and a browser extension for one-click repair.

### What it doesn't do yet

- **No OCR.** Scanned PDFs are detected and refused with a clear message, not turned into garbage.
- **One and two columns only.** Three-column journals are not handled.
- **Tables are not reconstructed as tables.** Their text is sequenced as text.
- **Mathematics is not spoken correctly.** Use a dedicated math tool for that.
- **Right-to-left scripts** are not handled.
- **Text over background images** and unusual font encodings can lose runs.
- **No user study yet.** We have not measured outcomes with disabled students.

---

## Built with

`react` `typescript` `vite` `pdf.js` `mespeak` `vitest` `playwright` `axe-core` `css`

---

## Try it

**https://plumb-akw.pages.dev**

No signup. The landing page opens a **two-column sample** in one click. The
Before / after tab shows the stored order and the repaired order side by side.

---

## Repo

https://github.com/MirzaAliAkbar/plumb (GPL-3.0-or-later licensed).

```bash
cd app
npm install
cp .env.example .env.local   # add a Clerk publishable key; optional for the demo
npm run dev
```

## Credits

Plumb uses React, Vite, pdf.js, Clerk, Vitest, Playwright, axe-core, and `mespeak` (eSpeak
compiled to JS, GPL-3.0, for the offline read-aloud fallback). The project is licensed
GPL-3.0-or-later to comply with `mespeak`'s license. The disability and screen-reader figures
come from WebAIM's Screen Reader User Survey #10, the National Center for Education Statistics,
and the PNP Student Factsheet 2025. AI assistance was used for code review, copy editing and
test scaffolding; the architecture, algorithm and final decisions are the team's.
