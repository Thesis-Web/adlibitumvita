import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth.js";

export const prerender = false;

export const GET: APIRoute = (ctx) => auth.handler(ctx.request);
export const POST: APIRoute = (ctx) => auth.handler(ctx.request);
