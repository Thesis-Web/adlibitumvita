import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import { admin as adminPlugin } from "better-auth/plugins";
import { env } from "./env.js";

export const auth = betterAuth({
  database: new Database(env.DATABASE_PATH),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.BETTER_AUTH_URL],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [adminPlugin({ defaultRole: "user" })],
  advanced: {
    cookiePrefix: "adlibitumvita",
    useSecureCookies: env.NODE_ENV === "production",
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
