import type { APIRoute } from "astro";
import { z } from "zod";
import { grantLibraryAccess, revokeLibraryAccess } from "../../../../../lib/entitlements.js";

export const prerender = false;

const bodySchema = z.object({ action: z.enum(["grant", "revoke"]) });

export const POST: APIRoute = async (ctx) => {
  const { id } = ctx.params;
  if (!id) return new Response(null, { status: 404 });

  const json: unknown = await ctx.request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return new Response(JSON.stringify({ error: z.flattenError(parsed.error) }), { status: 400 });

  if (parsed.data.action === "grant") grantLibraryAccess(id);
  else revokeLibraryAccess(id);

  return new Response(null, { status: 204 });
};
