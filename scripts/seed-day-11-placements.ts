/**
 * Hand-authored editorial image placement for canonical Captain's Log Day 11
 * ("The Last Harbor") — the one representative Day used to prove the illustrated-book
 * placement vocabulary before it is applied to the other 42 Days.
 *
 * Day 11 was chosen because its source prose already carries five author-written
 * chapter headings (Chapter One — The Alarm / Two — A Town Learning to Breathe Again /
 * Three — Leaving the Last Harbor / Four — Trials and Tribulations / Five — Mile Zero)
 * and its single Facebook post carries 27 photographs, more than enough to exercise
 * hero, inline, wide, and paired layouts without resorting to gallery-only padding.
 *
 * Placements were chosen by reading the actual prose and viewing the actual extracted
 * photographs (see the private canonical-image-manifest.json for provenance); every
 * anchor below is a literal substring of the real body_markdown. Anything not placed
 * here remains fully visible in the entry's "More from Day 11" gallery — nothing is
 * discarded.
 *
 * Idempotent: safe to re-run (replaceEditorialPlacements replaces all rows for the
 * content entry). Requires the Day 11 canonical text AND its images to already be
 * ingested (via import-captains-log-canonical.ts and import-canonical-images.ts).
 */
import "dotenv/config";
import { getContentEntryBySlug } from "../src/lib/content.js";
import { getMediaAssetBySourceUri } from "../src/lib/media-assets.js";
import { replaceEditorialPlacements, type EditorialPlacementInput } from "../src/lib/editorial-placements.js";

const SOURCE_PREFIX = "this_profile's_activity_across_facebook/posts/media/Mobileuploads_376716367938884/";

interface PlanRow {
  filename: string;
  layoutRole: EditorialPlacementInput["layoutRole"];
  paragraphAnchor: string;
  groupKey?: string;
  groupOrder?: number;
  caption?: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

const PLAN: PlanRow[] = [
  {
    filename: "1393295102947667.jpg",
    layoutRole: "inline",
    paragraphAnchor: "empty foundation appears where a family once gathered",
    caption: "Rebuilt fencing and river rock now sit in front of a hillside still scarred by the 2024 wildfire.",
    confidence: "medium",
    reason:
      "First photo after entering town that visually shows burn-scarred hillside directly behind active rebuilding — matches the paragraph's 'walk and you'll see it' framing, though not a specific address the text names.",
  },
  {
    filename: "1393295256280985.jpg",
    layoutRole: "wide",
    paragraphAnchor: "Sometimes ten houses vanished while one remained standing in the middle",
    caption: "A rebuilt crosswalk and construction equipment, burned hillside still visible behind the neighborhood.",
    confidence: "medium",
    reason: "Widest, most legible single frame showing the scale of the rebuild described in this paragraph.",
  },
  {
    filename: "1393295406280970.jpg",
    layoutRole: "landscape-pair",
    paragraphAnchor: "Other homes looked perfectly livable.\nFresh paint.\nWindows intact.",
    groupKey: "jasper-homes",
    groupOrder: 0,
    caption: "Finished and landscaped — one of the homes that made it through, or was rebuilt first.",
    confidence: "medium",
    reason: "Paired with the framed-in house below to show the range of rebuild states the paragraph describes.",
  },
  {
    filename: "1393295599614284.jpg",
    layoutRole: "landscape-pair",
    paragraphAnchor: "Other homes looked perfectly livable.\nFresh paint.\nWindows intact.",
    groupKey: "jasper-homes",
    groupOrder: 1,
    caption: "Still framed in — a rebuild in progress a few doors down.",
    confidence: "medium",
    reason: "Paired with the finished house above; both are real photos of Jasper rebuild sites, contrasted deliberately.",
  },
  {
    filename: "1393296016280909.jpg",
    layoutRole: "chapter-opener",
    paragraphAnchor: "Chapter Three — Leaving the Last Harbor",
    caption: "Looking out over the rail yard, on the way out of town.",
    confidence: "high",
    reason: "A literal harbor/rail departure image directly under the chapter titled 'Leaving the Last Harbor'.",
  },
  {
    filename: "1393296516280859.jpg",
    layoutRole: "inline",
    paragraphAnchor: "The first drops arrived almost politely.",
    caption: "Burned forest still lines the highway as the rain closes in.",
    confidence: "high",
    reason: "Directly illustrates the storm-and-burn-scarred-highway driving described at the start of Chapter Four.",
  },
  {
    filename: "1393296622947515.jpg",
    layoutRole: "inline",
    paragraphAnchor: "You don't negotiate with nature.\nYou learn to work within it.",
    caption: "A glacier-fed lake along the way — the reward alongside the trial.",
    confidence: "medium",
    reason: "Placed beside the paragraph's reflection on working with, not against, difficult conditions.",
  },
  {
    filename: "1393296689614175.jpg",
    layoutRole: "inline",
    paragraphAnchor: "We simply accepted that this was the weather we'd been given.",
    caption: "Driving on into the dark, storm behind us.",
    confidence: "medium",
    reason: "Near-black dusk highway shot closing out the day's drive, placed near the chapter's closing reflection.",
  },
];

function main(): void {
  const content = getContentEntryBySlug("captains-log", "day-11");
  if (!content) {
    throw new Error('content_entries row for slug "day-11" not found — run the canonical text import first.');
  }

  const inputs: EditorialPlacementInput[] = [];
  const skipped: string[] = [];

  PLAN.forEach((row, index) => {
    const sourceUri = `${SOURCE_PREFIX}${row.filename}`;
    const asset = getMediaAssetBySourceUri(content.id, sourceUri);
    if (!asset) {
      skipped.push(sourceUri);
      return;
    }
    inputs.push({
      mediaId: asset.id,
      layoutRole: row.layoutRole,
      paragraphAnchor: row.paragraphAnchor,
      groupKey: row.groupKey ?? null,
      groupOrder: row.groupOrder ?? 0,
      sortOrder: index,
      captionOverride: row.caption ?? null,
      confidence: row.confidence,
      reason: row.reason,
    });
  });

  const created = replaceEditorialPlacements(content.id, inputs, null);

  console.log(
    JSON.stringify(
      { contentId: content.id, placementsCreated: created.length, planned: PLAN.length, skippedMissingMedia: skipped },
      null,
      2,
    ),
  );
  if (skipped.length > 0) {
    console.log(`\n${skipped.length} planned placement(s) skipped — media not yet ingested for those source URIs.`);
  }
}

main();
