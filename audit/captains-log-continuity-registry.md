# Captain's Log — Entity & Continuity Registry

**Status: READ-ONLY AUDIT.** Machine-readable version: `captains-log-continuity-registry.json`.

Built from a full chronological close-read of Days 1-42 (two passes, Days 1-21 then 22-42,
each checked against the other for cross-batch repetition). See
`captains-log-editorial-audit.md` for the accompanying repetition/continuity findings this
registry supports.

## Entities

| Entity | Type | First introduced | Notes |
|---|---|---|---|
| Dory (expedition van) | vehicle | Day 1 (named Day 22) | Called "the Sprinter"/"the van" through Day 21; the name "Dory" appears with no origin story starting Day 22 — a continuity gap, not a repetition (see EF2-07). |
| James (narrator/father) | person | Day 1 (named Day 6) | 48, longtime sailor/guide; large new business/military-adjacent backstory revealed Days 25/29/34. |
| Amber (wife/mother) | person | Day 1 (named Day 2) | First salmon Day 25; homeschooling/household backstory revealed Day 34. |
| Jude (son) | person | Day 1 (named Day 2) | ~14; first sockeye Day 18, first wild rainbow Day 25; three older adult siblings revealed Day 34 — recontextualizes earlier "our son" framing. |
| "Ad Libitum Vita" / "Live Life Unscripted" | concept | Day 1 | Mostly a hashtag/sign-off; illustrated in action at Day 4, bookended at Day 21. |
| "We measure money in time, not dollars" | concept | Day 10 | **Most-repeated concept in the archive** — fully argued 4 times (Days 10 ×2, 15, 32) plus the Days 34-35 essay. |
| Sailing / nautical metaphor | concept | Day 4 | Well-sustained throughout; one sub-motif ("doldrums", Days 38-39) and one chapter-title reuse ("Safe Harbor", Days 28 & 32) flagged. |
| "Vacation became an expedition" turning point | concept | Day 11 | Declared 3 times (Days 11, 12, 16) at 3 different milestones. |
| Jasper wildfire & rebuilding | place/event | Day 10 | Day 11's on-foot detail is a legitimate continuation, not a repeat. |
| "It's about the people, not the places" | concept | Day 22 | Restated almost point-for-point the very next day, twice. |
| Melancholy / psychological toll | concept | Day 30 | Original treatment; later echoed (not repeated) by the "doldrums" motif. |
| Monetization / Patreon essay | concept | Day 34 | Self-contained ~3-post tangent; author's own notes call it "off topic." |
| Day 13 numbering conflict | continuity flag | Day 13 | **RESOLVED.** Human review confirmed original Day numbers are unreliable; the two posts are now canonical Days 13 and 14 respectively. See `day-number-mapping.json`. |

## How to read "judgment" values in the JSON file

- **NEW_INFO** — genuinely new fact/detail, not a repeat.
- **CALLBACK** — brief, earned reference to something already established; not a problem.
- **DEVELOPMENT** — revisits an established concept but genuinely extends it.
- **REDUNDANT_REINTRODUCTION** — re-explains something already fully established, with little new content; the category the editorial findings act on.

## Note on day numbers in this document

This document's "Day N" references (including the table above and the JSON file) use the
**original** Facebook-post-labeled day numbers, since that's how the two close-reading passes
were keyed. See `day-number-mapping.json` and `facebook-import-manifest.md` for the canonical
website Day numbers established after human editorial review — only original label "Day 13"
requires special handling (it splits into canonical Days 13 and 14); every other canonical
day number is either equal to (original Days 1-12) or exactly one greater than (canonical
Days 15-43) its original label.

## Headline continuity takeaway

The archive is internally consistent on facts (no contradictions in family details, vehicle
identity, or timeline beyond the single Day 13 numbering conflict). The dominant editorial
issue is **thematic over-explanation**, not factual repetition: the same 3-4 philosophical
theses (money=time, vacation-became-expedition, people-not-places, the nautical metaphor's
sub-motifs) each get re-derived from scratch multiple times across the 42 days rather than
being built on incrementally. See `captains-log-editorial-audit.md` for the specific,
surgical recommendations.
