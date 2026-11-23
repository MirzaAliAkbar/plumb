# DECISIONS

Every fork that cost real time, and why we took the branch we took. Written so a
reader can disagree with a decision on its merits rather than guess at it.

---

## D1 — Build for the rubric, not for a sponsor

**Decision.** Optimise against the four published judging criteria. Ignore
"which sponsor technology should we use".

**Why.** There are no sponsor API tracks and no sponsor prizes in this hackathon
(`research/FIELD_INTEL.md` §1). Any effort spent integrating a sponsor platform
would buy nothing. The rubric is the whole game, and it is weighted equally
across four criteria with **Usefulness & Impact** as the first tiebreaker.

**Cost.** We give up the "flashy tech" route to a 5 on Innovation, and have to
earn it with a genuine mechanism instead.

**Revisit if.** A sponsor track appears — then a working integration becomes a
cheap 5 on Implementation.

---

## D2 — No LLM anywhere in the core path

**Decision.** The reading-order reconstruction is deterministic geometry. No model
calls, no API keys, no inference.

**Why.** Three separate reasons, any one of which is sufficient:
1. It has to work **offline** after first load — an LLM call cannot.
2. Judges may run it without a key; 5 of the 40 competitors are un-runnable for
   exactly that reason.
3. An accessibility tool that hallucinates a paragraph order is worse than one
   that refuses. Determinism is a safety property here, not a preference.

**Cost.** We cannot claim "AI-powered", which some judges may look for. We accept
that; the rubric rewards a working prototype over a fashionable one, and
"complexity alone does not earn a higher score" is the rubric's own wording.

---

## D3 — The export is the product; the overlay is the demo

**Decision.** The durable deliverable is an HTML file the user keeps. The numbered
overlay is evidence for a sighted judge, not the thing a blind user consumes.

**Why.** The red team's sharpest hit was that a numbered overlay is a
sighted-person debugging tool — a blind user cannot verify it. They were right.
The answer is not to delete the overlay (it is the two-second demo hook) but to
demote it and make the export the artifact that matters, opened in the user's own
trusted screen reader.

**Cost.** Two surfaces to build and test instead of one.

---

## D4 — Scope to born-digital, one and two columns

**Decision.** Explicitly support born-digital PDFs with one or two columns.
Refuse scanned documents with a clear message rather than guessing.

**Why.** Three-column journals and OCR are each a project of their own. A tool
that does one thing completely scores higher on Implementation than one that does
four things adequately. Stated limitations also score: the rubric explicitly
rewards explaining limitations.

**Cost.** A judge testing a three-column paper sees a limitation, not a win.

---

## D5 — Detect columns by character density, not by empty gutters

**Decision.** Find the gutter as the thinnest vertical slice relative to the
density either side of it, then band the page at every spanning line.

**Why.** The naive "find a band no text touches" approach fails on exactly the
documents that matter: a full-width title or a spanning figure crosses the gutter,
so it is never empty and a two-column page is read as one column. We hit this on
our own sample before writing the algorithm.

**Cost.** A more complex detector, and a confidence score that has to be earned
rather than asserted.

---

## D6 — Refuse to report certainty on a page with no detected gutter

**Decision.** A single-column page never reports 100% confidence. Confidence is
built from concrete signals and compounds with layout uncertainty.

**Why.** Our first version returned 100% on every single-column page and flagged
nothing across 144 real pages. A signal that never fires is decoration. "I found
no gutter" is not the same claim as "I am sure there is none", and for an
assistive tool a confident wrong answer is the worst outcome because the user
cannot see the page to check.

**Cost.** Lower headline numbers. 89.6% mean looks worse than a dishonest 100%.

---

## D7 — Ship the accuracy harness in the repo

**Decision.** `tools/accuracy.mts` and `tools/structure.mts` are checked in, and CI
runs the structure audit on real papers.

**Why.** It converts every number in the submission from an assertion into
something a judge can re-run. It also caught three real bugs that the test suite
did not: page numbers never suppressed, section headings absorbed into
paragraphs, and a gutter threshold wider than a real gutter.

**Cost.** CI fetches six arXiv papers on every run. The papers are fetched by
script rather than vendored, because they are other people's work.

---

## D8 — Generate our own sample PDF

**Decision.** `tools/make-sample.mjs` writes a synthetic two-column paper.

**Why.** Shipping a real arXiv paper in the repo means redistributing someone
else's work. Generating one also let us build the sample *before* the algorithm,
so the naive detector's failure was visible rather than hypothetical.

**Cost.** A synthetic sample is less impressive than a real paper. Mitigated by
the landing page accepting any real PDF a judge drags in.

---

## D9 — Cloudflare Pages for hosting

**Decision.** Static build deployed to Cloudflare Pages.

**Why.** The build is fully static, so any host works. Pages gives a stable URL,
sensible cache headers via `_headers`, and no cold-start penalty. The offline
service worker needs the app to be served over HTTPS with correct MIME types.

**Cost.** Vendor coupling on the deploy command. Trivial to move.

---

## D10 — Unpublish the competitor scrapes

**Decision.** The 40 scraped Devpost pages are kept locally and gitignored. Only
the analysis derived from them (`research/FIELD_INTEL.md`) is published.

**Why.** Republishing other people's project pages in a public repo is not ours to
do. The conclusions are the useful artifact; the raw copies are not.

**Cost.** A judge cannot re-derive our field analysis from the repo. They can
re-run the Devpost search themselves.

## D11 — License: GPL-3.0-or-later, not MIT

**Decision.** The project is GPL-3.0-or-later.

**Why.** The offline read-aloud fallback bundles `mespeak` (eSpeak compiled to
JS), which is GPL-3.0. Distributing it inside an MIT project would make the
combined work GPL-derivative while the README claimed MIT — a mismatch a judge
could catch. Relicensing to GPL-3.0-or-later keeps the fallback (so read-aloud
works on a machine with no system voice) and stays open source. The alternative,
dropping the fallback to keep MIT, was rejected because it makes read-aloud fail
on Linux without speech-dispatcher, which is the demo machine.

**Cost.** We lose the permissive MIT label. GPL is still OSS, and consistency is
worth more than the label.

**Revisit if.** We replace `mespeak` with a permissively licensed synthesizer.
