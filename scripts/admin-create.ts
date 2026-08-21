import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { auth } from "../src/lib/auth.js";
import { grantLibraryAccess } from "../src/lib/entitlements.js";
import { getDb } from "../src/db/client.js";

interface Args {
  email: string;
  name: string;
  force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const email = get("--email");
  const name = get("--name");
  if (!email || !name) {
    throw new Error('Usage: admin:create -- --email user@example.com --name "Name" [--force]');
  }
  return { email, name, force: argv.includes("--force") };
}

async function promptPassword(): Promise<string> {
  if (process.env.ADMIN_BOOTSTRAP_PASSWORD) {
    return process.env.ADMIN_BOOTSTRAP_PASSWORD;
  }
  const rl = createInterface({ input: stdin, output: stdout });
  const password = await rl.question("Password (min 12 chars, not echoed to shell history): ");
  rl.close();
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");
  return password;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const db = getDb();

  const existingAdmin = db
    .prepare<[], { id: string }>("SELECT id FROM user WHERE role = 'admin' LIMIT 1")
    .get();
  if (existingAdmin && !args.force) {
    throw new Error(
      "An admin user already exists. Pass --force to create another admin, or use /admin/users after logging in.",
    );
  }

  const password = await promptPassword();

  const result = await auth.api.createUser({
    body: { email: args.email, password, name: args.name, role: "admin" },
  });

  const userId = result.user.id;
  grantLibraryAccess(userId);

  console.log(`Admin user created: ${args.email} (id: ${userId})`);
  console.log("Library access granted. Log in at /login.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
