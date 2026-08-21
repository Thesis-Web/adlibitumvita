import type { APIRoute } from "astro";
import { z } from "zod";
import { getContentEntryById, updateContentEntry } from "../../../../lib/content.js";

export const prerender = false;

const patchSchema = z.object({
  collection: z.enum(["captains-log", "beyond-the-map"]).optional(),
  title: z.string().min(1).optional(),
  slug: z.string().optional(),
  subtitle: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  body_markdown: z.string().min(1).optional(),
  status: z.enum(["draft", "published"]).optional(),
  visibility: z.enum(["members", "public"]).optional(),
  day_number: z.number().int().nullable().optional(),
  chapter_number: z.number().int().nullable().optional(),
  section_number: z.string().nullable().optional(),
  expedition_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  sort_order: z.number().nullable().optional(),
});

export const PATCH: APIRoute = async (ctx) => {
  const { id } = ctx.params;
  if (!id || !getContentEntryById(id)) return new Response(null, { status: 404 });

  const json: unknown = await ctx.request.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: z.flattenError(parsed.error) }), { status: 400 });
  }

  const entry = updateContentEntry(id, parsed.data, ctx.locals.user?.id ?? null);
  return new Response(JSON.stringify(entry), { headers: { "content-type": "application/json" } });
};

export const GET: APIRoute = (ctx) => {
  const { id } = ctx.params;
  const entry = id ? getContentEntryById(id) : undefined;
  if (!entry) return new Response(null, { status: 404 });
  return new Response(JSON.stringify(entry), { headers: { "content-type": "application/json" } });
};
