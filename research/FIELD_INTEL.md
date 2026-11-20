# FIELD INTELLIGENCE — LaunchPad Hacks (Hack4TodayOrg)

> Verified 2026-11-20 from official Devpost pages + 40 scraped submission pages
> (`research/pages/*.txt`, `research/projects_inventory.md`).

## 1. Hard facts (verified)

| Item | Value |
|---|---|
| Deadline | **Dec 4, 2026, 5:00 PM EST** (14 days from now) |
| Judging | Dec 5 09:00 EST → Dec 9 17:00 EST |
| Winners announced | Dec 10, 2026 |
| Prize | 1st = **$300 cash**; 2nd/3rd = gallery recognition only |
| Participants | 643 registered |
| Submissions found | 40 (search API `total_count: 40`) |
| Tracks | **None.** Single open track, any stack |
| Sponsor API tracks | **None.** No required platform, no sponsor prize |
| Eligibility | Students only, above age of majority, no companies |

### Judging rubric — 4 criteria, equal weight, 1–5 each (max 20)

1. **Innovation & Originality** — fresh solution, thoughtful improvement, creative use of tech
2. **Usefulness & Impact** — real problem, value to intended users, *evidence of user needs*, positive impact
3. **Implementation & Functionality** — working prototype delivers core promise; *"complexity alone does not earn a higher score"*
4. **Design & Presentation** — understandable, easy to use, **accessibility**, clarity of UX, and how clearly the submission explains **problem, solution, demo, and limitations**

**Tiebreak order:** Usefulness & Impact → Implementation & Functionality → panel review.

### Required deliverables
Devpost page (name, pitch, team) · description (problem, users, solution, tech, challenges, learned) ·
working demo link or recorded walkthrough + setup steps · screenshots · **2–3 min video "encouraged but optional"** ·
source link · credit third-party libs/datasets/AI assistance/pre-existing work.

---

## 2. The competitive field (40 submissions, analysed)

### Signal frequency across all 40

| Signal | Count / 40 | Reading |
|---|---|---|
| Live clickable demo | 27 | **table stakes** |
| Automated tests / CI | 20 | table stakes at the top |
| Explicit Limitations section | 18 | common among strong entries |
| Vanilla JS, no framework | 15 | common |
| React/Vue/build step | 14 | common |
| Accessibility mentioned | 10 | **rare** |
| Named research citations | 7 | **rare** |
| Demo video | 7 | **rare** |
| MIT/OSS license | 7 | **rare** |
| Offline / PWA | 6 | rare |
| Requires API key/paid service | 5 | **liability — judges may not be able to run it** |
| Login required to try | 4 | **friction liability** |
| **Real user research** | **3** | **rarest signal in the entire field** |

### Tier summary
Roughly **8–11 strong (S)**, 5 A, 7 B, 10 C, 7 D/slop.
Bottom of the field is AI-generated filler: empty descriptions, `//edit this later`,
no demo, no screenshots, spam resubmitted across multiple hackathons.

### The top 3 to beat (estimated 19/20 each)

| Project | What it is | Why it scores |
|---|---|---|
| **Al límite** | Spanish public-procurement anomaly analysis, 1.47M records | Real dataset, exact statistics, 52 tests, local LLM output *verified* before publish. Data-journalism grade. |
| **Backcast** (Shotaro Takakura) | Paste syllabus → backwards workload plan + heatmap + verified one-click fixes | Vanilla JS zero-dep, 28 unit + Playwright E2E, real `<table>` a11y with spoken labels, EN/JP parsing, cited Buehler 1994 + Steel 2007, honest limitations. Built in 1 day. |
| **Crunchmap** (Hyunsik Parker) | Same problem space, different author | 22 unit + 5 Playwright + axe, CSP zero-network, bilingual, 1m47s captioned video, MIT. |
| **WhenCode** | Account-free group meeting finder, bitmap share codes | 13 unit + 9 Playwright across 4 timezones, DST-correct, CSP, full keyboard/SR support |
| **Playable but Private** | FPGA Ascon-AEAD128 JPEG encryption | Genuine hardware research, 11 attacks benchmarked, IEEE submission |

### ⚠️ SATURATED LANES — do not enter
- **Student syllabus / deadline / workload planners** → Backcast *and* Crunchmap both own this, both excellent.
- **Group meeting scheduling** → WhenCode.
- **Scam / fraud detection** → Ruko, ProofLedger.
- **Contract & renewal deadline calculators** → Renewal Clock.
- **Hackathon submission trackers** → Fieldwork.
- **CSV/settings diff tools** → RunDelta, Handoff Lock.
- **Generic "AI assistant" wrappers** → Boltthon, Skill Path, BigPharma, VivaMed (all weak).
- **Campus accessibility routing** → Campus Reconnect.

### The single biggest exploitable gap
> **Accessibility is explicitly named in rubric criterion 4, yet 30/40 projects say nothing about it,
> and only ~3 actually test it.**
> User research is done by 3/40. A demo video exists for 7/40. Named citations for 7/40.

**Conclusion:** a project that is *accessibility-first by construction*, ships a captioned
video, cites real evidence, states honest limitations, is MIT-licensed, needs no account and
no API key, and is visibly polished will out-signal ~37 of 40 competitors on criterion 4
alone — while having an uncontested claim on criterion 2 (usefulness) if the need is provable.

---

## 3. Winning formula (derived, not guessed)

| Requirement | Why | Non-negotiable? |
|---|---|---|
| Zero-friction live demo (no login, no key, instant) | 5 projects can't even be run by a judge | **Yes** |
| Provable need with named sources | Criterion 2 is the **first tiebreaker**; only 7/40 cite anything | **Yes** |
| Real accessibility engineering (axe + keyboard + SR labels) | Criterion 4 names it; 3/40 do it | **Yes** |
| Automated tests + CI | Table stakes at the top; proves "implementation" | **Yes** |
| Explicit, specific Limitations section | Criterion 4 scores it explicitly; honesty reads as engineering judgement | **Yes** |
| Captioned 90–150s demo video | Only 7/40 have one; judges deliberate from it | **Yes** |
| MIT license + clean README | 7/40; cheap credibility | Yes |
| One core insight explainable in one sentence | Survives panel discussion | **Yes** |
| Avoid saturated lanes | Being 4th-best syllabus planner scores 0 prizes | **Yes** |

**Score target: ≥19/20.** No criterion below 4; at least two 5s.

**Where the remaining upside is:** *real user evidence*. All top competitors admit
"not user-tested yet". Any project that can show even a small honest usability test
(n=8–15, real tasks, measured) wins the tiebreaker outright.

---

## 4. Judge-risk profile

Judges are recruited via a public Google Form (`forms.gle/n3Wr7rdSdeJhwpKF7`) — likely
generalist, possibly non-technical, reviewing many projects quickly. Implications:

- The product must be **understandable in 10 seconds** without explanation.
- The Devpost page must **lead with the problem**, not the stack.
- Avoid jargon in the first paragraph.
- Anything requiring local install, a key, or a login will simply not be evaluated.
