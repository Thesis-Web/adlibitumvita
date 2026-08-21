import type { APIRoute } from "astro";

export const prerender = true;

const BODY = `User-agent: *
Allow: /
Disallow: /library
Disallow: /admin
Disallow: /account
Disallow: /api

Sitemap: https://adlibitumvita.com/sitemap.xml
`;

export const GET: APIRoute = () => {
  return new Response(BODY, { headers: { "content-type": "text/plain" } });
};
