import type { APIRoute } from "astro";
import { getDb } from "../../db/client.js";
import buildInfo from "../../generated/build-info.json";

export const prerender = false;

export const GET: APIRoute = () => {
  let dbOk = false;
  try {
    getDb().prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? "healthy" : "unhealthy";
  return new Response(JSON.stringify({ status, git_sha: buildInfo.git_sha, db: dbOk ? "ok" : "error" }), {
    status: dbOk ? 200 : 503,
    headers: { "content-type": "application/json" },
  });
};
