# CANDIDATE IDEAS — five contenders

Derived from `research/FIELD_INTEL.md`. Every idea below avoids the saturated lanes,
runs with **zero backend / zero API key / zero login**, and is deployable as a static site.

Scoring columns are the rubric's four criteria (1–5). "Risk" is build/demo risk.

---

## IDEA 1 — **ORDER** · *PDF reading-order repair for screen-reader users*

**The problem.** Academic PDFs are overwhelmingly untagged. A screen reader then reads
text in raw content-stream order, which for two-column papers and exported lecture slides
is nonsense — it interleaves the columns, jumps to footnotes mid-sentence, and reads
running headers between every line. Free remediation tooling (Acrobat Pro, PAC) is
inspector-grade and institutional; no free browser tool *fixes* reading order at read time.

**The product.** Drop a PDF. ORDER extracts text blocks with their coordinates, infers the
true reading order (line clustering → column detection → header/footer suppression →
block sequencing), and shows it as a **numbered overlay on the page** — so you can *see*
the order before you hear it. Then it renders a clean, semantic, reflowable reading view
with text-to-speech that follows the corrected order and highlights as it speaks. Where
confidence is low, it says so and lets you drag a block to fix it. It never silently lies
to a screen reader.

**The one-sentence insight.** *Reading order is a layout problem, and layout is recoverable
from geometry — so it can be fixed in the browser, for free, before the screen reader ever
sees it.*

**Why it wins.** Accessibility is explicitly named in criterion 4 and 30/40 competitors
ignore it. The demo is a **visual before/after**: the same PDF, numbered boxes in scrambled
order, then correct order. Instantly legible to a non-technical judge. Real algorithm, not
a wrapper → Implementation 5.

**Biggest risk.** Correctness on pathological layouts. Mitigation: transparent confidence
score + manual correction, and scope to the two shapes that matter (two-column papers,
exported slides).

| Innovation | Usefulness | Implementation | Design | Risk |
|---|---|---|---|---|
| 5 | 5 | 4–5 | 5 | Medium |

---

## IDEA 2 — **MATHVOICE** · *make equations speakable*

**The problem.** Screen readers cannot read math. NVDA/JAWS read `∫₀^∞ e^{-x²}dx` as
character soup. Blind and low-vision STEM students are effectively locked out of equations
in PDFs, slides, and LMS pages. MathML helps — but almost no course material ships it.

**The product.** Paste LaTeX, type MathML, or select an equation region; get correct spoken
mathematics ("the integral from zero to infinity of e to the minus x squared, dx"), with
structural navigation — move by term, by fraction, by exponent — and a linear
"read it in order" mode plus a "describe the structure" mode.

**The one-sentence insight.** *Math is a tree, not a string — speak the tree, not the glyphs.*

**Why it could win.** Extremely underserved population, visceral unfairness, clear story.

**Biggest risk.** The **Speech Rule Engine (SRE)** from MathJax is open source and already
does MathML→speech. This collapses to "wrap SRE in a UI", which a technical judge will
spot. Originality is thinner than it looks. Image→LaTeX (the interesting part) is
research-grade and not viable in 2 weeks.

| Innovation | Usefulness | Implementation | Design | Risk |
|---|---|---|---|---|
| 3 | 5 | 4 | 4 | High (originality) |

---

## IDEA 3 — **CAPTIONFIX** · *repair auto-captions for technical lectures*

**The problem.** Auto-captions are 85–90% accurate on everyday speech but far worse on
STEM vocabulary — "eigenvalue" becomes "eye gun value", "Hessian" becomes "Asian". Deaf and
hard-of-hearing students get captions that are present but useless, which is worse than
absent because it looks compliant.

**The product.** Drop a `.vtt`/`.srt`. CAPTIONFIX flags low-confidence spans against a
technical glossary, proposes corrections with evidence, and exports a corrected caption
file plus a glossary sidecar for the next lecture.

**The one-sentence insight.** *Caption failure is concentrated in vocabulary, and vocabulary
is a solvable, curatable problem.*

**Why it could win.** Cheap to build well, very demoable ("eye gun value" → "eigenvalue"),
genuinely useful, and the before/after is funny *and* damning.

**Biggest risk.** Ceiling. It is a text-correction utility — Innovation is capped around 3–4,
and the "evidence of need" is thinner than ORDER's. Feels like a feature, not a product.

| Innovation | Usefulness | Implementation | Design | Risk |
|---|---|---|---|---|
| 3 | 4 | 5 | 4 | Low |

---

## IDEA 4 — **CHARTSENSE** · *make chart images accessible*

**The problem.** Figures in papers and slides are images. A screen reader says "image".
Blind students lose every chart, graph, and diagram — a large fraction of the actual
information in a STEM paper.

**The product.** Drop a chart image. CHARTSENSE detects axes, bars, lines and labels, then
produces (a) a real data table, (b) a written description of the trend, and (c) an optional
sonification so the shape is audible.

**The one-sentence insight.** *A chart is a data table wearing a costume — and the costume
is removable.*

**Why it could win.** Highest ceiling on Innovation if it works. Genuinely novel.

**Biggest risk.** Chart de-rendering from pixels is hard and failure is *visible and
embarrassing* — a wrong table is worse than no table. High chance of a demo that works on
the three charts you prepared and breaks on the judge's.

| Innovation | Usefulness | Implementation | Design | Risk |
|---|---|---|---|---|
| 5 | 4 | 3 | 4 | **Very high** |

---

## IDEA 5 — **FORMGUIDE** · *cognitive accessibility for bureaucratic forms*

**The problem.** University and government forms — financial aid, accommodation requests,
visa paperwork — are dense, jargon-heavy, and assume you already know the system. First-gen,
ESL, and cognitively disabled students abandon them or fill them in wrong.

**The product.** Load a form PDF. FORMGUIDE extracts the fields, explains each in plain
language, shows exactly which document satisfies it, tracks what is still missing, and
produces a checklist you can take to the office.

**The one-sentence insight.** *Forms fail not because people can't read, but because nobody
told them what the question actually means.*

**Why it could win.** Broad, sympathetic, high-stakes audience. Different failure mode from
the vision-centric ideas.

**Biggest risk.** Plain-language rewriting without an LLM means either a thin curated rule
set (weak) or an API key (violates the no-key constraint and can't run offline). Also the
weakest *visual* demo of the five.

| Innovation | Usefulness | Implementation | Design | Risk |
|---|---|---|---|---|
| 3 | 5 | 3 | 3 | High (constraint conflict) |

---

## Summary table

| # | Idea | Inn | Use | Imp | Des | Total | Risk | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | ORDER | 5 | 5 | 5 | 5 | **20** | Med | Front-runner |
| 2 | MATHVOICE | 3 | 5 | 4 | 4 | 16 | High | SRE problem |
| 3 | CAPTIONFIX | 3 | 4 | 5 | 4 | 16 | Low | Ceiling-limited |
| 4 | CHARTSENSE | 5 | 4 | 3 | 4 | 16 | V.High | Demo fragility |
| 5 | FORMGuIDE | 3 | 5 | 3 | 3 | 14 | High | Constraint conflict |

These are *my* priors. The debate below is designed to overturn them.
