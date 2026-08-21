import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

function resolveGitSha(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev-local";
  }
}

const buildInfo = {
  git_sha: resolveGitSha(),
  built_at: new Date().toISOString(),
};

writeFileSync(join(process.cwd(), "src/generated/build-info.json"), `${JSON.stringify(buildInfo, null, 2)}\n`);
console.log("wrote src/generated/build-info.json", buildInfo);
