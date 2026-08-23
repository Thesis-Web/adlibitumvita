/**
 * Pure helpers shared by scripts/import-canonical-images.ts and its tests.
 * Kept dependency-free (no db/fs access) so the day-grouping/ordering logic
 * and extension-to-mime mapping can be unit tested without fixtures on disk.
 */

export interface ManifestImage {
  canonical_day_number: number;
  slug: string;
  title: string | null;
  source_post_index: number | null;
  source_post_role: "primary" | "continuation" | "aside" | "edited";
  is_primary: boolean;
  source_uri: string;
  expected_source_filename: string;
  description: string | null;
  gallery_order: number;
}

export interface ManifestFile {
  summary: Record<string, unknown>;
  images: ManifestImage[];
}

/** Groups images by canonical day, each day's list sorted by gallery_order ascending. */
export function groupImagesByDay(images: ManifestImage[]): Map<number, ManifestImage[]> {
  const byDay = new Map<number, ManifestImage[]>();
  for (const image of images) {
    const list = byDay.get(image.canonical_day_number) ?? [];
    list.push(image);
    byDay.set(image.canonical_day_number, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.gallery_order - b.gallery_order);
  return byDay;
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

/** Maps a lowercased file extension (with leading dot) to a MIME type, or undefined if unsupported. */
export function resolveDerivativeMimeType(ext: string): string | undefined {
  return MIME_BY_EXT[ext.toLowerCase()];
}
