import type { APIRoute } from "astro";
import { z } from "zod";
import { deleteMediaAsset, getMediaAssetById, updateMediaAsset } from "../../../../lib/media-assets.js";
import { getMediaStorage } from "../../../../lib/media/index.js";

export const prerender = false;

const patchSchema = z.object({
  altText: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  isCover: z.boolean().optional(),
  visibility: z.enum(["members", "public"]).optional(),
});

export const PATCH: APIRoute = async (ctx) => {
  const { id } = ctx.params;
  if (!id || !getMediaAssetById(id)) return new Response(null, { status: 404 });

  const json: unknown = await ctx.request.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return new Response(JSON.stringify({ error: z.flattenError(parsed.error) }), { status: 400 });

  updateMediaAsset(id, parsed.data);
  return new Response(JSON.stringify(getMediaAssetById(id)), { headers: { "content-type": "application/json" } });
};

export const DELETE: APIRoute = async (ctx) => {
  const { id } = ctx.params;
  if (!id) return new Response(null, { status: 404 });

  const asset = deleteMediaAsset(id);
  if (!asset) return new Response(null, { status: 404 });

  const storage = getMediaStorage();
  await storage.delete(asset.storage_key);
  if (asset.thumbnail_key) await storage.delete(asset.thumbnail_key);

  return new Response(null, { status: 204 });
};
