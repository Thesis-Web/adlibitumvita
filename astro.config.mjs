import node from "@astrojs/node";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  site: "https://adlibitumvita.com",
  server: {
    port: Number(process.env.PORT ?? 3211),
    host: "127.0.0.1",
  },
  security: {
    checkOrigin: true,
  },
  // Better Auth owns session state (SQLite + cookies) — Astro's own
  // filesystem-backed Sessions API is unused and would otherwise write
  // under node_modules/.astro/sessions at runtime.
  session: false,
});
