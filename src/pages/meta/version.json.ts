import type { APIRoute } from "astro";
import buildInfo from "../../generated/build-info.json";

export const prerender = true;

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({ app: "adlibitumvita", git_sha: buildInfo.git_sha, built_at: buildInfo.built_at }),
    { headers: { "content-type": "application/json" } },
  );
};
