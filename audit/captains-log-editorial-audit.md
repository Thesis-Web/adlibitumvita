# Captain's Log — Editorial Audit

**Status: READ-ONLY AUDIT, REVISION 2.** No rewrites were applied to any source content.
This summarizes `editorial-findings.json` and `title-normalization.json`; both are the
machine-readable detail behind this document.

**Day-number note:** the continuity/repetition findings below (`editorial-findings.json`,
`captains-log-continuity-registry.json`) cite the **original** Facebook-post-labeled day
numbers, since that's how the two close-reading passes were keyed before the canonical
renumbering. `title-normalization.json` has been rebuilt to use **canonical** day numbers.
See `day-number-mapping.json` for the full translation table, and
`facebook-import-manifest.md` for why the canonical sequence now has 43 days instead of the
original labels' apparent 42.

## Scope

Full close-read of all 42 originally-labeled candidate Captain's Log days (Days 1-21 and
22-42, two independent passes cross-checked against each other), covering title formatting
and cross-chapter continuity/repetition. See `facebook-import-manifest.md` for the
canonical (43-day) chronological grouping this audit's findings were later reconciled
against.

## Title normalization (Phase 3)

43 canonical days audited (following the human-approved Day 13 split — see
`day-number-mapping.json`). **36 SAFE_NORMALIZATION** (mechanical punctuation/order fixes —
dash style, missing colons, apostrophe curling, date-vs-day-number ordering, including the
newly-split canonical Day 13), **4 EDITORIAL_RECOMMENDATION** (canonical Days 27, 35, 36
need their split parts merged before a title can be finalized; canonical Day 39 has a
scheduling-apology preamble ahead of its real title), **3 JUDGMENT_CALL** (canonical Days 6,
7, 8 each have two competing subtitle candidates — a quoted creative title vs. a tagline —
where only the author can say which is primary). Full per-day table in
`title-normalization.json`.

Two structural patterns worth calling out for the eventual admin/import tooling:
- **Canonical Days 1-8 lead with a calendar date, not "Day N"** ("Captain's Log 6-20-26");
  the day number is instead embedded lower in the text. Days 9+ lead with "Day N" directly.
  Any importer must search the text body for the day number on early entries, not just the
  header line — the existing discovery tooling (`src/lib/facebook-import.ts`) already does
  this (title → text-head → text-body, in that order). The same file also now includes
  `extractLogDate()`, which parses the explicitly-stated calendar date on canonical Days 1-8
  and correctly returns nothing for Days 9-43, where no calendar date is stated in text at
  all — see the "Log-date parser correction" note in `facebook-import-manifest.md`.
- Punctuation is wildly inconsistent (em-dash "—", en-dash "–", hyphen "-", or nothing, plus
  "Captain's" vs "Captains" vs curly "Captain's") but the *content* is not — every one of
  the 43 canonical days already states its Day number somewhere in the opening lines. This
  is a cosmetic, not editorial, problem for 36 of 43 days.

## Continuity / repetition audit (Phase 4)

18 findings total across both passes — **9 HIGH confidence, 6 MEDIUM, 3 LOW**; **8
EDITORIAL_RECOMMENDATION, 6 JUDGMENT_CALL, 4 SAFE_NORMALIZATION**. Full detail with
excerpts in `editorial-findings.json`; entity-level detail in
`captains-log-continuity-registry.md`.

### The headline pattern: thematic over-explanation, not factual error

The archive has no internal factual contradictions. Its main continuous-book problem is
that four philosophical/framing devices — **"we measure money in time, not dollars"**
(re-derived fully 4 times: Days 10 ×2, 15, 32, plus the Days 34-35 essay), **"vacation
became an expedition"** (3 times: Days 11, 12, 16), **"it's about the people, not the
places"** (twice cross-day plus once intra-day: Days 22-23), and the **"doldrums"** nautical
sub-motif (twice back-to-back: Days 38-39) — each get re-explained from first principles
every time they recur, instead of being built on. None of these are wrong in isolation;
each was written as a self-contained Facebook post. Read as one continuous book, they
compound.

### Highest-priority findings

1. **EF-01 / EF-02 / EF2-02 (money=time thesis, HIGH)** — recommend treating Day 10's
   original argument as definitive; merge the Day 10 same-day aside into it (EF-01), and
   shorten/trim the Day 15, Day 32, and Days 34-35 restatements to callbacks.
2. **EF2-01 (Days 34-35 monetization tangent, HIGH)** — the single largest structural
   interruption in the archive; the author's own in-text notes call it "off topic" and
   "ramblings." Recommend relocating to an appendix/author's-note rather than leaving it as
   three consecutive main-narrative chapters.
3. **EF-03 / EF2-03 (cumulative route recaps, HIGH)** — the same state-by-state/park-by-park
   list repeats 4 times in Days 11-12 alone (once self-acknowledged: "we covered this
   yesterday, but...") and again in Days 32/34. Recommend keeping one full recap per major
   milestone and compressing the rest.
4. **EF-04 (Day 13 conflict, HIGH) — RESOLVED.** Two posts claimed Day 13 but described
   sequential, non-overlapping geography. Human review confirmed original Day-number labels
   are not authoritative; the sequence is now built from narrative chronology instead, and
   the two posts are canonical Days 13 and 14 respectively. See `facebook-import-manifest.md`
   and `day-number-mapping.json`.
5. **EF2-05 (doldrums motif, HIGH)** — fully re-explained from scratch in the opening
   chapter of two consecutive entries (Days 38-39); recommend merging to one explanation
   plus a callback.

### Lower-priority / judgment calls worth an editor's eye

EF-02, EF-05, EF-06, EF-07, EF-08, EF2-04, EF2-06, EF2-08 — see `editorial-findings.json`
for each. None are urgent; several (the nautical metaphor generally, the Day 21 "Ad Libitum
Vita" bookend) were explicitly judged as *not* problems — intentional callbacks/refrains
rather than redundant re-explanation — and are documented in the registry for completeness,
not as findings requiring action.

### Continuity gaps (not repetition, but worth an editor's eye)

- **EF2-07** — the van is named "Dory" starting Day 22 with no naming/origin story after 21
  days of being called only "the Sprinter"/"the van."
- **EF2-08** — Day 32 promises a cost-breakdown reveal "tomorrow"; Day 33 never addresses
  it, and the figure only surfaces in passing three days later.
- Day 34 reveals Jude has three older adult siblings, recontextualizing the "our son"
  framing used throughout the rest of the archive (registry entry, not a finding requiring
  a fix — just worth an editor's awareness).

## What this audit deliberately did not do

No prose was rewritten. No entries were merged, split, or reordered in any data store —
`facebook-import-manifest.md` documents the recommended merges/resequencing as
recommendations for a future, explicitly human-reviewed import pass.
