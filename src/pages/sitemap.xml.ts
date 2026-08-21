import type { APIRoute } from "astro";

export const prerender = true;

// Every /library/** route requires authentication regardless of an entry's
// visibility flag — there are no public content detail pages in this IA, so
// the sitemap only ever lists genuinely public, ungated routes.
export const GET: APIRoute = ({ site }) => {
  const base = site?.toString().replace(/\/$/, "") ?? "https://adlibitumvita.com";
  const urls = ["/", "/login"];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${base}${path}</loc></url>`).join("\n")}
</urlset>
`;

  return new Response(body, { headers: { "content-type": "application/xml" } });
};
