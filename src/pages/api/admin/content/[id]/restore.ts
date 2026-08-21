import type { APIRoute } from "astro";
import { z } from "zod";
import { restoreRevision } from "../../../../../lib/content.js";

export const prerender = false;

const bodySchema = z.object({ revision_number: z.number().int().positive() });

export const POST: APIRoute = async (ctx) => {
  const { id } = ctx.params;
  if (!id) return new Response(null, { status: 404 });

  const json: unknown = await ctx.request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return new Response(JSON.stringify({ error: z.flattenError(parsed.error) }), { status: 400 });

  try {
    const entry = restoreRevision(id, parsed.data.revision_number, ctx.locals.user?.id ?? null);
    return new Response(JSON.stringify(entry), { headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 400 });
  }
};
