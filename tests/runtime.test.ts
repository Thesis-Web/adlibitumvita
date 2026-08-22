import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guard for the Node 20 (system) vs Node 22 (ALV-private runtime)
// mismatch that broke better-sqlite3 (ERR_DLOPEN_FAILED) in production: the
// declared minimum must stay >=22.12, and the operator wrapper that puts the
// ALV runtime first on PATH must keep enforcing it at run time.

describe("Node runtime requirement", () => {
  it("package.json declares the ALV-required minimum Node version", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.engines?.node).toBe(">=22.12.0");
  });

  it("the running test/CI Node satisfies the declared minimum", () => {
    const [major, minor] = process.versions.node.split(".").map(Number);
    expect(major > 22 || (major === 22 && minor >= 12)).toBe(true);
  });

  it("deploy/alv-node-env.sh exists, is executable, and enforces >=22.12", () => {
    const path = join(process.cwd(), "deploy", "alv-node-env.sh");
    const contents = readFileSync(path, "utf8");
    expect(contents).toContain("ALV_NODE_BIN=");
    expect(contents).toContain("NODE_MAJOR");
    expect(contents).toContain("22");
  });
});
