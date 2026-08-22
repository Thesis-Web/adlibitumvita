import type { APIRoute } from "astro";
import { listPublicEntries } from "../lib/content.js";

// Server-rendered (not prerendered): public Captain's Log entries change after deploy,
// and this route must reflect the live database, not a build-time snapshot. Every
// /library/** route requires authentication regardless of an entry's visibility flag, so
// the sitemap only ever lists genuinely public, ungated routes.
export const GET: APIRoute = ({ site }) => {
  const base = site?.toString().replace(/\/$/, "") ?? "https://adlibitumvita.com";
  const staticUrls = ["/", "/login", "/captains-log"];
  const captainsLogUrls = listPublicEntries("captains-log")
    .filter((entry) => entry.indexable === 1)
    .map((entry) => ({ path: `/captains-log/${entry.slug}`, lastmod: entry.updated_at }));

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.map((path) => `  <url><loc>${base}${path}</loc></url>`).join("\n")}
${captainsLogUrls.map((u) => `  <url><loc>${base}${u.path}</loc><lastmod>${u.lastmod.slice(0, 10)}</lastmod></url>`).join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "content-type": "application/xml", "cache-control": "public, max-age=300" },
  });
};
