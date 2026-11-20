# SUBMISSION — paste-ready Devpost copy

> Everything below is written against the four judging criteria. Do not pad it;
> every paragraph is doing one of four jobs: prove the problem is real, prove it
> works, show the design, or state the limits honestly.

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
A screen reader can only follow the order the file happens to store — and in a
two-column paper, that order interleaves the columns. The reader hears the left
column and the right column alternating, sentence by sentence.

It gets worse: **71.6% of screen reader users navigate by jumping between
headings** (WebAIM Screen Reader User Survey #10). A document with no heading
structure is not merely harder for those users. It is unnavigable.

**21% of US undergraduates report a disability** (NCES), but only **8% register
with their institution's disability office** (PNPI, citing NCES). The other ~13%
never get access to the institutionally-licensed assistive software that would
fix this for them. A free tool in the browser reaches exactly those people, and
nobody else's.

The tools that exist either *diagnose* the problem (Acrobat Pro, PAC, veraPDF all
tell you tags are missing) or require a licence and a registered disability
status (Kurzweil, Read&Write). Read-aloud tools fix the *words* and leave the
*sequence* broken. We could not find a free, instant, in-browser tool that
actually repairs reading order — so we built one.

---

## What it does

Drop a PDF. Plumb:

1. **Extracts** every text run with its exact page position, locally, using
   pdf.js — nothing is uploaded.
2. **Reconstructs** the reading order from geometry: clustering runs into lines,
   detecting columns from density, removing repeated headers and footers, and
   sequencing blocks into bands.
3. **Shows you what it decided** — a numbered overlay on the page, colour- and
   pattern-coded by confidence, that you can audit.
4. **Reads** the result in a clean, reflowed view with synchronised text-to-speech.
5. **Exports** semantic HTML — real `<h2>`, `<p>`, `<ul>`, `<figcaption>` — as a
   file you keep and open in your own screen reader.

No account. No API key. No server. Works offline after first load.

---

## How we built it

**The core problem is not "read the text". It is "decide the order", and the
obvious approach fails.**

The naive way to find columns is to look for a vertical band of the page that no
text touches. We tried it, measured it, and found it breaks on exactly the
documents that matter most: a full-width title, a spanning figure, or a table row
crosses the gutter, so the gutter is never empty and the page is misread as a
single column. On our own sample document it failed outright — the title covered
the gutter and the two-column page read as one column.

So the layout detector instead builds a **character-density profile** across the
page width and finds the *thinnest vertical slice relative to the density either
side of it*. Lines are then classified as left, right, or **spanning**, and the
page is split into horizontal **bands** at every spanning line. Within a band the
order is left column then right column; across bands it is top to bottom.

That single change is what makes a title land before both columns, a caption stay
with its figure, and a paragraph never interleave with the column beside it.

**Confidence is real, not decorative.** Each block carries a confidence derived
from concrete signals — how clean the gutter was, whether the block straddles it,
whether the left edges agree, whether font sizes churn mid-paragraph. Below 60%
the block is visibly flagged and the export marks it. We deliberately do **not**
report certainty on a page where we could not find a gutter at all: "I found no
columns" is not the same as "I am sure there are none".

**The outline is the point.** A repaired reading order is only useful if the
export carries real heading structure, because that is how the 71.6% navigate. On
the six-paper corpus the export emits **167 real `<h2>`/`<h3>` elements with zero
skipped heading levels** — the actual section titles, nested as the paper nests
them ("3.1. Residual Learning" under "3. Deep Residual Learning"). Getting there
meant fixing two subtle bugs. A numbered section heading was being absorbed into
the paragraph above it, because it sits just inside both the gap and size
thresholds. And "1. Introduction" matches the same pattern as an ordered-list
item, so top-level sections were being exported as `<li>` bullets — the outline
was destroyed by the very rule meant to describe it. The classifier now judges a
line on its own before merging, and uses capitalisation to tell a section title
from a list entry.

**Stack:** React 19, TypeScript, Vite 8, pdf.js. Hand-written CSS — no UI
framework, so every focus state, contrast ratio and target size is ours to get
right. Vitest for the pipeline, Playwright + axe-core for end-to-end and
accessibility.

**The pipeline is a pure function of extracted geometry**, which is why all of it
can be unit-tested without a browser or a PDF.

---

## Challenges we ran into

1. **Naive column detection failed on our own sample.** Documented above — this
   was the main engineering problem, and it is why the algorithm looks the way it
   does. We caught it by building the sample PDF *before* the algorithm, so the
   failure was visible rather than hypothetical.

2. **pdf.js returns content-stream order**, which is the thing we are trying to
   correct. Line clustering had to be made independent of input order, which
   sounds trivial and is not: runs on the same baseline in different columns are
   adjacent in the stream and must be split by horizontal gap.

3. **Confidence was initially dishonest.** Our first version returned 100%
   confidence on every single-column page, and flagged nothing on 144 pages of
   real papers. A signal that never fires is not a signal — it is decoration. We
   rewrote it to earn confidence from evidence, and it now discriminates (79–96%
   across the corpus, with 0–10% of blocks flagged).

4. **A heading that was not a heading, and a heading that was a bullet.** Section
   headings set at near-body size were merging into the paragraph above, and
   "1. Introduction" was matching the ordered-list pattern and being exported as a
   `<li>`. Both silently cost the document its outline — the one thing a
   screen-reader user depends on. We only found them by auditing the *structure*
   of the export rather than its text. A title is now recognised on its own, before
   merging, and capitalisation separates a section title from a list entry.

4. **Accessibility bugs that automated tools caught, not us.** axe found a
   nested-interactive control (a file input inside a `role="button"` container), a
   form field with no label, and `--ink-400` at 3.58:1 contrast. All three are
   fixed and the scan is now part of CI.

5. **Our own contrast audit was lying.** It kept a duplicate copy of the palette
   which drifted from the stylesheet, so it reported a failure on a colour the app
   no longer used — and would have passed a genuinely bad colour for the same
   reason. It now parses the tokens straight out of the CSS, and we tested it in
   both directions to prove it still fails when it should.

---

## What we learned

- **"Correct" is not the same as "trustworthy".** For an assistive tool, a
  confident wrong answer is worse than a visible "I am not sure", because the user
  cannot see the page to check. Designing the uncertainty display took as long as
  the algorithm.
- **Measure the claim or drop it.** We wrote a corpus harness that runs the
  pipeline over real papers and prints the actual numbers. Every figure in this
  submission comes from it or from a named source — we deleted two statistics we
  could not verify.
- **The obvious citation can be stale.** The ADA Title II compliance dates that
  everyone quotes (April 2026) were extended to April 2027/2028 by an Interim
  Final Rule in April 2026. Citing the old date would have been wrong and checkable.

---

## Limitations — stated plainly

We would rather be trusted than look complete.

- **No OCR.** Scanned PDFs are detected and refused with a clear message, not
  turned into garbage.
- **One and two columns only.** Three-column journals are not handled.
- **Tables are not reconstructed as tables.** Their text is sequenced as text.
- **Mathematics is not spoken correctly.** Use a dedicated math tool for that.
- **Right-to-left scripts** are not handled.
- **Text over background images** and unusual font encodings can lose runs.
- **No user study yet.** We have not measured outcomes with disabled students, and
  we are not going to claim we have.

---

## Accessibility of the app itself

Criterion 4 explicitly scores accessibility, so it is verified rather than
asserted:

- **axe-core: zero violations** against WCAG 2.2 A/AA, on both the landing page
  and the reading view, enforced in CI.
- **Every text pair meets AA contrast**, computed rather than eyeballed
  (`tools/contrast.mjs` asserts it).
- **Full keyboard operation** — the overlay blocks are focusable, the tool is
  operable without a mouse, and the focus ring is strengthened rather than removed.
- **Confidence is never signalled by colour alone** — border style (solid /
  dashed / dotted) and a text label carry the same information, so it survives
  colour blindness and forced-colours mode.
- **Semantic HTML throughout** — the reading view emits real headings, lists and
  figure captions, which is the same thing we are asking of the PDFs.
- Respects `prefers-reduced-motion` and `forced-colors`; no horizontal overflow at
  200% zoom or at 390px.

---

## Built with

`react` `typescript` `vite` `pdf.js` `vitest` `playwright` `axe-core` `css`

---

## Try it

**https://plumb-akw.pages.dev**

No signup. The landing page has a **one-click sample two-column paper** so you can
see the before/after in about three seconds.

---

## Repo

`[GitHub URL]` — MIT licensed. `npm install && npm run dev`.
