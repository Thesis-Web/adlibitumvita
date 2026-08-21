import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import { getContentEntryById } from "../../../../../lib/content.js";
import { env } from "../../../../../lib/env.js";
import { createMediaAsset } from "../../../../../lib/media-assets.js";
import { getMediaStorage } from "../../../../../lib/media/index.js";
import { generateMainDerivative, generateThumbnailDerivative, isAcceptedImageMime } from "../../../../../lib/media/transform.js";

export const prerender = false;

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const POST: APIRoute = async (ctx) => {
  const { id } = ctx.params;
  if (!id || !getContentEntryById(id)) return new Response(null, { status: 404 });

  const formData = await ctx.request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return new Response(JSON.stringify({ error: "No files provided." }), { status: 400 });
  }

  const storage = getMediaStorage();
  const created = [];
  const rejected = [];

  for (const file of files) {
    if (!isAcceptedImageMime(file.type)) {
      rejected.push({ name: file.name, reason: `Unsupported type: ${file.type}` });
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      rejected.push({ name: file.name, reason: "File exceeds 25MB limit." });
      continue;
    }

    const raw = Buffer.from(await file.arrayBuffer());
    const main = await generateMainDerivative(raw);
    const thumb = await generateThumbnailDerivative(raw);

    const baseKey = `${id}/${randomUUID()}`;
    const key = `${baseKey}.webp`;
    const thumbKey = `${baseKey}-thumb.webp`;

    await storage.put(key, main.buffer, main.mimeType);
    await storage.put(thumbKey, thumb.buffer, thumb.mimeType);

    const asset = createMediaAsset(
      {
        contentId: id,
        storageProvider: env.MEDIA_DRIVER,
        storageKey: key,
        thumbnailKey: thumbKey,
        mimeType: main.mimeType,
        width: main.width,
        height: main.height,
        byteSize: main.buffer.byteLength,
        visibility: "members",
      },
      ctx.locals.user?.id ?? null,
    );
    created.push(asset);
  }

  return new Response(JSON.stringify({ created, rejected }), {
    status: created.length > 0 ? 201 : 400,
    headers: { "content-type": "application/json" },
  });
};
