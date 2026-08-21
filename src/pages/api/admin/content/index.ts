import type { APIRoute } from "astro";
import { z } from "zod";
import { createContentEntry } from "../../../../lib/content.js";

export const prerender = false;

const bodySchema = z.object({
  collection: z.enum(["captains-log", "beyond-the-map"]),
  title: z.string().min(1),
  slug: z.string().optional(),
  subtitle: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  body_markdown: z.string().min(1),
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

export const POST: APIRoute = async (ctx) => {
  const json: unknown = await ctx.request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: z.flattenError(parsed.error) }), { status: 400 });
  }

  const entry = createContentEntry(parsed.data, ctx.locals.user?.id ?? null);
  return new Response(JSON.stringify(entry), { status: 201, headers: { "content-type": "application/json" } });
};
