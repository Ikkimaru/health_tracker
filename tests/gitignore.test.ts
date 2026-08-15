import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("private project configuration", () => {
  it("keeps every private agent configuration path out of Git", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    for (const pattern of [
      "AGENTS.md",
      "AGENTS.local.md",
      ".agents/",
      ".codex/",
      "*.agent.private.md"
    ])
      expect(ignore).toContain(pattern);
  });
});
