# DEBATE RESULT — one winner

Five advocates, three blind judges, one red team. Full transcripts were produced by
independent agents; this is the integrated verdict.

## Vote tally

| Idea | Judge A (generalist) | Judge B (engineer) | Judge C (a11y) | Mean |
|---|---|---|---|---|
| **ORDER** | 19 | 19 | 20 | **19.3** |
| CAPTIONFIX | 16 | 16 | 16 | 16.0 |
| MATHVOICE | 15 | 13 | 15 | 14.3 |
| CHARTSENSE | 15 | 13 | 12 | 13.3 |
| FORMGUIDE | 13 | 12 | 12 | 12.3 |

**Winner: ORDER** — unanimous first place across all three judges.

## Why the others lost

- **CAPTIONFIX** — genuinely good, lowest risk, but Innovation is structurally capped at 3
  ("glossary lookup + diff"). Cannot reach 19 because no criterion can be a 5 on originality.
- **MATHVOICE** — collapses to wrapping MathJax's Speech Rule Engine. All three judges
  independently called out the wrapper problem. Its only novel piece (image→LaTeX) is
  research-grade and not viable in two weeks.
- **CHARTSENSE** — highest ceiling, rejected on **AT safety grounds**: a confident wrong
  data table is worse than no table, and the user cannot verify. Demo would break on the
  judge's own chart. Correctly killed.
- **FORMGUIDE** — its core value (plain-language rewriting) requires an LLM, which the
  constraints forbid. Structurally self-contradicting.

## The red team's hit — and the correction

The red team argued ORDER is a trap: `getTextContent()` returns content-stream order,
two-column geometry is genuinely hard, and — the sharpest point — **a numbered overlay is
a sighted-person debugging tool; a blind user cannot verify it.** It recommended pivoting
to slides-only.

**The correction is accepted, but not as a kill.** Three changes resolve it:

1. **The overlay is not the product.** The overlay is the *demo hook for sighted judges*.
   The product is the **exported accessible HTML** — a permanent artifact the user opens in
   their own trusted screen reader. That is verifiable by ear, and it is what the red team
   itself called "the killer feature."
2. **Verify by ear, not by eye.** Beyond order, we recover **semantics** — headings,
   paragraphs, list items, code blocks. A blind user *can* verify semantics: they hear
   "Heading: Introduction. Paragraph. List, three items." That is checkable without sight.
3. **Measure and publish our own accuracy.** A reproducible corpus harness that runs the
   pipeline over real PDFs and reports where it succeeds and where it fails. This converts
   "confidence score" from a vague promise into a published, auditable number — and it is
   something no competitor did.

**Scope discipline adopted from the red team:** slides and single/two-column papers are the
supported shapes. Three-column journals, scanned pages, and multi-column tables are
explicit, stated limitations — not silent failures.

## Final decision

Build **ORDER**, evolved as above. Working name: **Plumb**.

Core insight, unchanged and still the strongest line in the field:
> *Reading order is a layout problem, and layout is recoverable from geometry — so it can be
> fixed in the browser, for free, before the screen reader ever sees it.*

## Score projection (post-correction)

| Criterion | Score | Basis |
|---|---|---|
| Innovation & Originality | 5 | Uncontested lane (0/40); real geometric algorithm; semantic recovery beyond order |
| Usefulness & Impact | 5 | Cited need; published accuracy harness; exported artifact |
| Implementation & Functionality | 5 | Real algorithm, tested, offline, zero-friction, honest failure modes |
| Design & Presentation | 5 | Accessibility as the product; visual before/after; captioned video; honest limitations |
| **Total** | **20** | Target ≥19 |
