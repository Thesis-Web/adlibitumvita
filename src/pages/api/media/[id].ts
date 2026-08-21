import type { APIRoute } from "astro";
import { Readable } from "node:stream";
import { getMediaAssetById } from "../../../lib/media-assets.js";
import { getMediaStorage } from "../../../lib/media/index.js";
import { hasLibraryAccess } from "../../../lib/entitlements.js";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const { id } = ctx.params;
  if (!id) return new Response(null, { status: 404 });

  const asset = getMediaAssetById(id);
  if (!asset) return new Response(null, { status: 404 });

  if (asset.visibility === "members" && !hasLibraryAccess(ctx.locals.user)) {
    return new Response(null, { status: 401 });
  }

  const thumb = ctx.url.searchParams.get("size") === "thumb" && asset.thumbnail_key;
  const key = thumb ? asset.thumbnail_key! : asset.storage_key;

  const storage = getMediaStorage();
  const publicUrl = asset.visibility === "public" ? storage.getPublicUrl(key) : null;
  if (publicUrl) {
    return Response.redirect(publicUrl, 302);
  }

  const object = await storage.getObjectStream(key);
  return new Response(Readable.toWeb(object.stream as Readable) as ReadableStream, {
    headers: {
      "content-type": object.mimeType,
      "cache-control": asset.visibility === "public" ? "public, max-age=86400" : "private, max-age=3600",
    },
  });
};
