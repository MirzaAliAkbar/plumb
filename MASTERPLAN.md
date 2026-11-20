# MASTERPLAN — Winning LaunchPad Hacks 2026

**Deadline:** Dec 4, 2026 5:00 PM EST · **Target:** 1st place ($300) · **Bar:** ≥19/20 on the rubric.

## Phase map

| # | Phase | Output | Status |
|---|---|---|---|
| 1 | Field intelligence | `research/FIELD_INTEL.md`, 40 scraped pages | ✅ done |
| 2 | Masterplan + constraints | this file, `DECISIONS.md` | ✅ done |
| 3 | Generate 5 candidate ideas | `IDEAS.md` | → |
| 4 | 5 adversarial agents debate → 1 winner | `DEBATE.md` | → |
| 5 | Spec + architecture for the winner | `SPEC.md` | → |
| 6 | Build (parallel workers, disjoint scopes) | app | → |
| 7 | Polish: design, a11y, copy, states | app | → |
| 8 | Verify: build, run, axe, smoke tests, screenshots | evidence | → |
| 9 | Demo video script + Devpost copy | `SUBMISSION.md` | → |
| 10 | Handoff report | `HANDOFF.md` | → |

## Hard constraints (locked)

1. **Static, client-side, no backend.** No API keys, no login, no server.
   Rationale: 5 competitors are un-runnable by judges; 4 require signup. Zero friction wins.
2. **Works offline after first load.** Service worker + local persistence.
3. **Accessible to WCAG 2.2 AA** and *provably* so (axe + keyboard-only E2E).
4. **Automated tests** (unit + E2E + a11y) running in CI.
5. **MIT licensed**, clean README with 3-line run instructions.
6. **Deployed to a URL that will not die** before judging ends (Dec 10).
7. **Honest Limitations section**, specific and credible.
8. **Avoid saturated lanes** (see FIELD_INTEL §2).

## Scoring strategy

| Criterion | How we win it |
|---|---|
| Innovation & Originality | A category nobody in the 40 entered; a core mechanism that is genuinely new, not a wrapper |
| Usefulness & Impact | Provable need with named sources + a real (small) usability test with numbers |
| Implementation & Functionality | It actually works, tested, offline, fast, no dead ends; scope disciplined to one thing done fully |
| Design & Presentation | Accessibility as the *product*, not a checkbox; a 90–150s captioned video; page structure that explains problem→solution→demo→limitations |

## Anti-goals

- No feature grab-bags. One job, done completely.
- No LLM dependency in the core path (offline requirement + judge risk).
- No "platform" ambitions. No dashboards of dashboards.
- No unverifiable claims. Every statistic on the Devpost page must be sourced.
