import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { env } from "../env.js";
import type { MediaObjectStream, MediaStorage } from "./storage.js";

const MIME_BY_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function resolveSafePath(key: string): string {
  const resolved = normalize(join(env.MEDIA_LOCAL_PATH, key));
  const root = normalize(env.MEDIA_LOCAL_PATH) + sep;
  if (!resolved.startsWith(root)) {
    throw new Error(`Rejected media key outside storage root: ${key}`);
  }
  return resolved;
}

export class LocalMediaStorage implements MediaStorage {
  async put(key: string, data: Buffer, _contentType: string): Promise<void> {
    const path = resolveSafePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async delete(key: string): Promise<void> {
    const path = resolveSafePath(key);
    await rm(path, { force: true });
  }

  async getObjectStream(key: string): Promise<MediaObjectStream> {
    const path = resolveSafePath(key);
    const info = await stat(path);
    const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
    return {
      stream: createReadStream(path),
      mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream",
      byteSize: info.size,
    };
  }

  getPublicUrl(): null {
    return null;
  }
}
