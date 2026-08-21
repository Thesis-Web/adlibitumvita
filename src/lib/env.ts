import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_PATH: z.string().min(1).default(".data/dev.sqlite3"),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.url(),
  MEDIA_DRIVER: z.enum(["local", "r2"]).default("local"),
  MEDIA_LOCAL_PATH: z.string().min(1).default(".data/media"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3211),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  if (parsed.data.MEDIA_DRIVER === "r2") {
    const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;
    const missing = required.filter((key) => !parsed.data[key]);
    if (missing.length > 0) {
      throw new Error(`MEDIA_DRIVER=r2 requires environment variables: ${missing.join(", ")}`);
    }
  }

  return parsed.data;
}

export const env = loadEnv();
