import sharp from "sharp";

export interface ImageDerivative {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: "image/webp";
}

const MAIN_LONG_EDGE = 1800;
const THUMB_LONG_EDGE = 500;
const QUALITY = 82;

async function toWebp(input: Buffer, longEdge: number): Promise<ImageDerivative> {
  const pipeline = sharp(input).rotate().resize({
    width: longEdge,
    height: longEdge,
    fit: "inside",
    withoutEnlargement: true,
  });
  const buffer = await pipeline.webp({ quality: QUALITY }).toBuffer();
  const meta = await sharp(buffer).metadata();
  return {
    buffer,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    mimeType: "image/webp",
  };
}

export async function generateMainDerivative(input: Buffer): Promise<ImageDerivative> {
  return toWebp(input, MAIN_LONG_EDGE);
}

export async function generateThumbnailDerivative(input: Buffer): Promise<ImageDerivative> {
  return toWebp(input, THUMB_LONG_EDGE);
}

const ACCEPTED_INPUT_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"]);

export function isAcceptedImageMime(mime: string): boolean {
  return ACCEPTED_INPUT_MIME.has(mime.toLowerCase());
}
