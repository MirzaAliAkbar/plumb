# Evidence

Every figure below was checked against the named source on 2026-11-20. Anything
that could not be verified is marked **UNVERIFIED** and is not used in the
submission copy.

---

## 1. How many students this affects

**21% of US undergraduates reported a disability in 2019–20**, along with 11% of
postbaccalaureate students.
— National Center for Education Statistics, *Fast Facts: Students with disabilities* (NCES 60)
https://nces.ed.gov/fastfacts/display.asp?id=60

NCES defines this to include "blindness or serious difficulty seeing" among other
conditions. The same NCES release is cited at 20.5% of undergraduates by
BestColleges' review of the underlying table, so treat this as ~20–21%.

**Only 8% of students registered with their institution's disability office** in
2019–20, against 21% who reported a disability.
— PNP Student Factsheet Booklet 2025, citing NCES
https://pnpi.org/wp-content/uploads/2025/06/Student-Factsheet-Booklet-2025_final.pdf

*Why this matters for the argument:* most students with a disability never reach a
disability office, so they never receive institutionally-licensed assistive
software. A free tool in the browser reaches the ~13% who fall outside the system.

---

## 2. What screen reader users actually do

**1,539 respondents** in the WebAIM Screen Reader User Survey #10.
— WebAIM, *Screen Reader User Survey #10*
https://webaim.org/projects/screenreadersurvey10/

The figure that matters most here:

**71.6% of screen reader users find information by navigating headings** — the
most common navigation strategy.
— WebAIM Screen Reader User Survey #10

*Why this is the single most important citation:* it means headings are not
decoration. A PDF with no heading structure is not "slightly worse" for these
users, it is unnavigable. Plumb's semantic HTML export emits real `<h2>`/`<h3>`
elements precisely so this 71.6% can move through a document instead of listening
to it linearly.

---

## 3. The legal deadline

The US Department of Justice Title II rule sets **WCAG 2.1 Level AA** as the
technical standard for state and local government web content and mobile apps,
and explicitly covers **"conventional electronic documents"** — which includes
PDFs.

⚠️ **The obvious citation is out of date.** The original 2024 rule set compliance
dates of April 2026 / April 2027. On **20 April 2026** DOJ published an Interim
Final Rule *extending* both by one year:

- Population ≥ 50,000 → **April 26, 2027**
- Population < 50,000 and special districts → **April 26, 2028**

— Federal Register, *Extension of Compliance Dates…*, 2026-04-20
https://www.federalregister.gov/documents/2026/04/20/2026-07663/
— ADA.gov, *State and Local Governments: First Steps*
https://www.ada.gov/resources/web-rule-first-steps/

Mass.gov's published guidance lists the covered content types explicitly:
"All state-provided documents in Word, PDF, PowerPoint and excel formats."
https://www.mass.gov/info-details/americans-with-disabilities-act-ada-title-ii-digital-accessibility-information

*Note on scope:* this rule binds public entities (public universities included),
not private companies. It is cited as evidence of direction of travel and of the
regulatory standard, **not** as a claim that any particular university is in
breach.

---

## 4. What free tooling already does, and does not do

Stated as capability comparison, not as statistics:

| Tool | What it does | Why it does not close the gap |
|---|---|---|
| Acrobat Pro, PAC 2024, veraPDF | *Inspect* a PDF and report that tags are missing | Diagnoses the problem; does not fix it at read time. Acrobat Pro is paid. |
| Kurzweil 3000, Texthelp Read&Write | Reading support, TTS | Institutionally licensed; requires the student to be registered with disability services — which 79% are not (§1). |
| Edge Read Aloud, Speechify | Speak the text | Speak it *in the file's stored order*. Fixing the words does not fix the sequence. |
| Browser reader modes | Strip layout from HTML | Do not apply to PDF content streams. |
| Re-tagging / remediation | Produce a permanently accessible file | The correct long-term fix, but requires an expert and does not scale to the documents a student meets tomorrow morning. |

**The gap Plumb targets:** repair at read time, free, in the browser, with no
licence, no account, and no expert — while being explicit about where it is unsure.

---

## 5. Our own measured results

Measured, not claimed. `npx tsx tools/accuracy.mts` over a corpus of 6 real
arXiv papers (144 pages), plus `npx tsx tools/structure.mts` for the structure of
the exported HTML:

| Metric | Result |
|---|---|
| Mean page reading-order confidence | 79–96% depending on document (mean 89.0%) |
| Clean text extraction (no replacement characters) | 6/6 documents |
| Blocks flagged low-confidence | 2.9% mean |
| Running headers/footers suppressed | 47 lines |
| Headings emitted as real `<h2>`/`<h3>` | 167 across the corpus |
| Heading-level skips in the export outline | 0 |
| Scanned-document detection | explicit refusal, not garbage |

The corpus harness is checked in, so the numbers are reproducible rather than
asserted — which is the point. The papers themselves are fetched by
`tools/fetch-corpus.mjs` rather than vendored, since they are other people's work.

---

## Claims deliberately NOT made

- No statistic for "what percentage of PDFs are untagged" — no source found that
  withstands scrutiny. **Not used.**
- No figure for how many students use screen readers specifically; NCES reports
  disability broadly, and conflating the two would be dishonest.
- No claim that any named university is non-compliant.
- No productivity or outcome-improvement claim. We have not run a user study.
