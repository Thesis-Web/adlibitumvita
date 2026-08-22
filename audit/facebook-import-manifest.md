# Facebook Import Manifest — Ad Libitum Vita Captain's Log

**Status: READ-ONLY AUDIT, REVISION 2 — supersedes the original 42-day-labeled manifest**
**per human editorial review. No import has been run. No production data was touched.**

Source: the real Meta "Download Your Information" export at
`/home/deploy/uploads/adlibitumvita/facebook-alv-json/` (private, untracked, immutable — not in this repo).

Full per-post detail (including body text) is intentionally NOT committed here — see
`/home/deploy/uploads/adlibitumvita/audit/facebook-import-manifest-v2-FULL.json` on the droplet.

## Revision history

### Canonical day renumbering from actual narrative chronology
The original Facebook Day-number labels are NOT authoritative (human review: the author confirms Day-number bookkeeping was unreliable while traveling). The canonical website sequence is instead built from narrative chronology: splits/continuations merge into one canonical day (no change from v1), and the original conflicting 'Day 13' label -- which actually described two sequential, non-overlapping expedition days -- is split into canonical Days 13 and 14, per the human-approved geographic sequence: Kluane Lake -> Alaska border -> Copper Center -> McCarthy Road -> McCarthy overnight -> Kennicott/Root Glacier. This shifts everything from the original Day 14 onward by +1. Total canonical entries: 43 (up from the apparent 42 in the original labels). original_day_label and canonical_day_number are preserved as separate fields on every entry.

### Log-date parser defect fixed
v1 of this manifest incorrectly populated 'stated_dates' with the Facebook POST timestamp's calendar date, not the Captain's Log's own stated date. For Days 1-8 (canonical 1-8), which explicitly state a date in the text header (e.g. 'Captain's Log 6-20-26'), this was often several days wrong -- e.g. canonical Day 1 states 2026-06-20 in text but was posted to Facebook on 2026-06-23 (a 3-day backlog gap). This is now fixed: 'log_date' is parsed from the post's own text (M-D-YY or, for later formats, a bare 'Month D' header) and is null when no date is stated in text -- which is the case for all of canonical Days 9-43, which state only 'Day N' with no calendar date anywhere in the post. 'facebook_published_at' is preserved separately as metadata on every entry and is NEVER substituted for a missing log_date.

## Summary

- Canonical daily entries: **43** (canonical Day 1 to Day 43)
- Original apparent day range (Facebook's own, unreliable labels): 1-42
- Entries with an explicit log_date stated in text: **8** (canonical Days 1-8 only)
- Entries with no calendar date stated in text (log_date intentionally null — do not backfill from Facebook timestamp): **35**
- Day 13 resolution: Original conflicting 'Day 13' label split into canonical Days 13 and 14 per human editorial decision (geographic sequence: Kluane Lake -> Alaska border -> Copper Center -> McCarthy Road -> McCarthy overnight -> Kennicott/Root Glacier). Everything from the original Day 14 onward shifts +1.

## Canonical day-by-day manifest

| Canonical Day | Original label | log_date | Media | Chars | Flags | Original opening line(s) |
|---|---|---|---|---|---|---|
| 1 | 1 | 2026-06-20 | 3 | 2507 | +1 aside(s) | "Captain's Log 6-20-26" |
| 2 | 2 | 2026-06-21 | 3 | 3881 | +1 aside(s) | "Captain's Log 6-21-26" |
| 3 | 3 | 2026-06-22 | 2 | 9185 | +4 aside(s) | "Captain's Log 6-22-26" |
| 4 | 4 | 2026-06-23 | 28 | 7118 | +6 aside(s) | "Captain's Log 6-23-26" |
| 5 | 5 | 2026-06-24 | 18 | 5289 | +6 aside(s) | ""Captain's Log 6-24-26" |
| 6 | 6 | 2026-06-25 | 9 | 4279 | +1 aside(s) | "Captain's Log 6-25-26" |
| 7 | 7 | 2026-06-26 | 1 | 8791 | +4 aside(s) | "Captain's Log- 6-26-26" |
| 8 | 8 | 2026-06-27 | 17 | 7442 | +1 aside(s) | "Captain's Log – 6-27-26" |
| 9 | 9 | *(none stated)* | 14 | 8622 | +2 aside(s) | "Captain's Log — Day 9" |
| 10 | 10 | *(none stated)* | 16 | 26348 | +1 aside(s) | "Captain's Log — Day 10" |
| 11 | 11 | *(none stated)* | 27 | 17881 | +1 aside(s) | "Day 11 — The Last Harbor" |
| 12 | 12 | *(none stated)* | 30 | 27826 | — | "Captain's Log — Day 12" |
| 13 | 13 (mislabeled; author confirms Day-13 numbering was a bookkeeping error) | *(none stated)* | 14 | 2843 | — | "Day 13 — The Final Test Before Alaska" |
| 14 | 13 (mislabeled; author confirms Day-13 numbering was a bookkeeping error) | *(none stated)* | 12 | 10448 | +2 aside(s) | "Captain’s Log — Day 13" |
| 15 | 14 | *(none stated)* | 30 | 16399 | +2 aside(s) | "Captain's Log - Day 14" |
| 16 | 15 | *(none stated)* | 13 | 11545 | — | "Captain's Log- Day 15" |
| 17 | 16 | *(none stated)* | 11 | 8448 | +1 aside(s) | "Day 16 — Captain's Log" |
| 18 | 17 | *(none stated)* | 13 | 12459 | +1 aside(s) | "Captain's Log — Day 17" |
| 19 | 18 | *(none stated)* | 16 | 10079 | — | "Captain's Log – Day 18: Where the River Felt Like Home" |
| 20 | 19 | *(none stated)* | 4 | 2542 | +1 aside(s) | "Captain's Log — Day 19" |
| 21 | 20 | *(none stated)* | 4 | 23710 | +1 aside(s) | "Captain’s Log — Day 20" |
| 22 | 21 | *(none stated)* | 7 | 15389 | — | "Captain's Log — Day 21" |
| 23 | 22 | *(none stated)* | 17 | 13433 | — | "Captain's Log — Day 22" |
| 24 | 23 | *(none stated)* | 7 | 17305 | — | "Captain's Log – Day 23" |
| 25 | 24 | *(none stated)* | 5 | 8313 | — | "Captain's Log — Day 24" |
| 26 | 25 | *(none stated)* | 10 | 45918 | — | "Captain’s Log — Day 25" |
| 27 | 26 | *(none stated)* | 0 | 55271 | SPLIT→MERGE | "Captain’s Log — Day 26"<br>"Evidently, I wrote longer than Facebook will allow. " |
| 28 | 27 | *(none stated)* | 16 | 13412 | — | "Captain's Log - Day 27 - The River That Looked Back " |
| 29 | 28 | *(none stated)* | 21 | 15919 | +1 aside(s) | "Captain's Log Day 28 - An Ad Libitum Day" |
| 30 | 29 | *(none stated)* | 12 | 12424 | — | "Captain's Log – Day 29" |
| 31 | 30 | *(none stated)* | 12 | 18750 | — | "Captain’s Log — Day 30 Freedom to Wander" |
| 32 | 31 | *(none stated)* | 13 | 16781 | — | "Captain's Log — Day 31 At the Edge of the Map" |
| 33 | 32 | *(none stated)* | 11 | 25614 | — | "Captain's Log – Day 32" |
| 34 | 33 | *(none stated)* | 19 | 41645 | — | "Captain’s Log — Day 33 The Long Road Home" |
| 35 | 34 | *(none stated)* | 18 | 51562 | SPLIT→MERGE | "Captains Log Day 34"<br>"Captain's Log Day 34 - continued..." |
| 36 | 35 | *(none stated)* | 13 | 51638 | SPLIT→MERGE | "Captains Log Day 35"<br>"Captains log day 35" |
| 37 | 36 | *(none stated)* | 10 | 20508 | — | "Captain’s Log — Day 36 " |
| 38 | 37 | *(none stated)* | 9 | 12294 | — | "Captain's Log — Day 37" |
| 39 | 38 | *(none stated)* | 12 | 4869 | — | "I had no Internet where we were so today it's a "two-fer". Remember daily posts are on patreon, here" |
| 40 | 39 | *(none stated)* | 14 | 7378 | — | "Captain's Log - Day 39- Breaking The Mold" |
| 41 | 40 | *(none stated)* | 28 | 14280 | — | "Captain's Log Day 40: Mesa Verde " |
| 42 | 41 | *(none stated)* | 12 | 17523 | — | "Captain's Log Day 41 — Moab, Utah" |
| 43 | 42 | *(none stated)* | 20 | 12085 | — | "Captain's Log Day 42 — Borrowed Time" |

## Grouping/resolution notes

**Canonical Day 8 (original: 8):** idx63 is a short Instagram-style cross-post referencing "Day 8" in its caption; idx64 is the full Captain's Log entry. Not a split — idx63 is a same-day supplemental aside.

**Canonical Day 10 (original: 10):** idx58 is explicitly self-labeled "(an aside)" — a same-day reflection on finances/reader support with Venmo/PayPal links, not a continuation of the Day 10 narrative.

**Canonical Day 13 (original: 13 (mislabeled; author confirms Day-13 numbering was a bookkeeping error)):** Human-approved split of the original conflicting 'Day 13' label. This entry covers Kluane Lake, Yukon through the Alaska border crossing ('Welcome to Alaska'). Chronologically precedes the McCarthy Road entry below.

**Canonical Day 14 (original: 13 (mislabeled; author confirms Day-13 numbering was a bookkeeping error)):** Human-approved split of the original conflicting 'Day 13' label. This entry covers Copper Center, Alaska (already inside the state) through the McCarthy Road and McCarthy overnight. idx50/idx52 (previously ambiguous between Day 13/Day 14 by date-co-occurrence) are assigned here on content grounds (Kennecott/Root Glacier subject matter matches this entry, not the original Day 14 'Crossing Into Another Century' entry which narrates the *next* morning after this one).

**Canonical Day 27 (original: 26):** Explicit split: idx34 ends "Continued...."; idx33 opens "Evidently, I wrote longer than Facebook will allow. Continued... Captain's Log Day 26, Chapter Fourteen." Canonical merge order: idx34 then idx33.

**Canonical Day 35 (original: 34):** Explicit continuation: idx21 title is literally "Captain's Log Day 34 - continued...". Canonical merge order: idx22 then idx21.

**Canonical Day 36 (original: 35):** Explicit continuation: idx20 ends with an editor's note about a business/monetization tangent; idx19 opens "Now that we have the business stuff done. We can get back to the log you enjoy." Canonical merge order: idx20 then idx19.
