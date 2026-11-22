# DEMO VIDEO: script

Target **1:45**. The rules say 2–3 minutes, "encouraged but optional". Short and
captioned beats long. Only 7 of 40 competitors submitted a video at all.

Record at 1440×900. Captions burned in (judges may watch muted, and captions are
themselves evidence about accessibility).

---

## 0:00–0:08: The hook

**Screen:** a two-column PDF, ordinary looking.

> "This is a normal academic paper. If you use a screen reader, this is what it
> sounds like."

## 0:08–0:20: The failure, demonstrated

**Screen:** the Before / after tab, or a screen reader reading the page. Audio
alternates visibly between columns: *"Assistive technology does not see a page.
It sees a sequence… In a two-column layout the two orders diverge badly."*

> "It's reading across the gutter: left column, right column, sentence after
> sentence. Every word is correct. The order is wrong."

**This is the most important 12 seconds of the video.** Do not rush it.

## 0:20–0:30: The claim

**Screen:** the Plumb landing page.

> "Plumb fixes the order. In your browser. Nothing uploaded, no account, no key."

## 0:30–0:50: The product

**Screen:** drag the PDF in. Processing. Result appears.

> "Drop the file. It pulls out every text run with its exact position, finds the
> columns from the geometry, and rebuilds the reading order."

**Screen:** the numbered overlay on the real page; hover a couple of blocks.

> "And it shows you exactly what it decided: every block numbered, in order,
> colour-coded by how sure it is. You can audit it instead of trusting it."

**Screen:** click *Before / after*. Point at a red arrow.

> "The file's own order is on the left, the repaired order on the right. On this
> sample, 65 of 69 lines move. That is the difference between the page and what a
> screen reader hears."

## 0:50–1:05: The proof

**Screen:** click *Reading view*. Then Read aloud.

> "Same document, reordered: left column, then right column. Real headings, real
> paragraphs."

**Screen:** screen reader reading the reordered version, flowing correctly.

> "Now it reads the way it was written."

## 1:05–1:20: The engineering (keep this tight)

**Screen:** the overlay on a page with a full-width title, or a quick cut to the
code/tests.

> "The hard part wasn't reading the text, it was deciding the order. The obvious
> approach: look for an empty vertical band: fails the moment a title or a figure
> crosses the gutter. So Plumb measures character density across the page and
> splits it into bands instead. That's what keeps the title above both columns."

**Screen:** terminal, `npx vitest run` → 85 passing; `npx playwright test` → 19
passing.

> "Eighty-five unit tests, nineteen end-to-end tests, and a zero-violation axe
> scan against WCAG 2.2, all in CI."

## 1:20–1:33: Honesty (this wins points)

**Screen:** README limitations section.

> "What it doesn't do: no OCR, so scans are refused. One and two columns only.
> Tables are sequenced as text. Where it's unsure, it says so per block. For an
> accessibility tool, a confident wrong answer is worse than an honest 'I'm not
> sure'."

## 1:33–1:45: Close

**Screen:** export downloading, then the HTML opened in a plain browser.

> "The output is a file you keep: real semantic HTML your own screen reader
> already knows how to use. Free, offline, no licence. That's Plumb."

---

## Production notes

- **Captions: mandatory.** Burn them in.
- **No music.** Voice only. It reads as serious.
- Record the screen-reader audio *for real*: do not narrate over it. The
  interleaved-columns audio is the whole argument.
- If the real screen reader is unavailable, use Plumb's own Read-aloud on the
  *original order* to demonstrate the failure, and say that is what you are doing.
- Keep the cursor still while text is on screen.
- Do not show a terminal with errors, a browser with 40 tabs, or a notification.
- End on the exported HTML, not on a logo.

## Thumbnail

The overlay screenshot: numbered blocks, visible order. It communicates "there is
a real algorithm here" in one glance.
