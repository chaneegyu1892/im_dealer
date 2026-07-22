import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETUP_SCRIPT = resolve(process.cwd(), "scripts/scraper-worker/setup.ps1");

describe("scraper worker setup script", () => {
  it("requires the minimum Node.js version supported by the pinned pnpm", async () => {
    // Given the PowerShell setup script used on worker PCs
    const source = await readFile(SETUP_SCRIPT, "utf8");

    // When its Node.js compatibility guard is inspected
    const nodeGuard = source.slice(source.indexOf("$nodeVersion"), source.indexOf("# ── 2."));

    // Then it compares the complete version against 22.13 and reports the same minimum
    expect(nodeGuard).toContain('[version]"22.13.0"');
    expect(nodeGuard).toMatch(/-lt\s+\$minimumNodeVersion/);
    expect(nodeGuard).toMatch(/22\.13/);
    expect(nodeGuard).not.toContain("$nodeMajor");
  });

  it("masks both secrets and clears native plaintext buffers after writing the env file", async () => {
    // Given the PowerShell setup script used to collect worker credentials
    const source = await readFile(SETUP_SCRIPT, "utf8");

    // When its two secret prompts and env-writing block are inspected
    const secretPrompts = source
      .split("\n")
      .filter((line) => line.includes("워커 비밀키\"") || line.includes("암호화 키\""));

    // Then neither value is echoed and both native buffers are zeroed after conversion
    expect(secretPrompts).toHaveLength(2);
    expect(secretPrompts.every((line) => line.includes("-AsSecureString"))).toBe(true);
    expect(source).toContain("SecureStringToBSTR");
    expect(source).toContain("PtrToStringBSTR");
    expect(source.match(/ZeroFreeBSTR/g)).toHaveLength(2);
  });
});
