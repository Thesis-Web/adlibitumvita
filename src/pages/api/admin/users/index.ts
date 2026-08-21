import type { APIRoute } from "astro";
import { z } from "zod";
import { auth } from "../../../../lib/auth.js";
import { grantLibraryAccess } from "../../../../lib/entitlements.js";

export const prerender = false;

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(12),
});

export const POST: APIRoute = async (ctx) => {
  const json: unknown = await ctx.request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: z.flattenError(parsed.error) }), { status: 400 });
  }

  try {
    const result = await auth.api.createUser({
      body: { email: parsed.data.email, password: parsed.data.password, name: parsed.data.name, role: "user" },
    });
    grantLibraryAccess(result.user.id);
    return new Response(JSON.stringify(result.user), { status: 201, headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 400 });
  }
};
