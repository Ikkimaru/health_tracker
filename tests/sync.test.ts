import { describe, expect, it } from "vitest";
import {
  decideSync,
  formatCooldownRemaining,
  formatSyncDate,
  parseConflictChoice
} from "../src/application/sync";

describe("refresh synchronization", () => {
  it("selects the side that changed since the last synchronized snapshot", () => {
    const metadata = { snapshotId: "snapshot-1", localHash: "shared" };
    expect(decideSync(metadata, "shared", "cloud-new", "snapshot-2")).toBe("restore");
    expect(decideSync(metadata, "local-new", "shared", "snapshot-1")).toBe("upload");
    expect(decideSync(metadata, "local-new", "cloud-new", "snapshot-2")).toBe("conflict");
    expect(decideSync(metadata, "same", "same", "snapshot-2")).toBe("none");
  });

  it("treats an unrecognized mismatch as a conflict", () => {
    expect(decideSync({}, "local", "cloud", "snapshot-1")).toBe("conflict");
  });

  it("allows conflict resolution to be cancelled", () => {
    expect(parseConflictChoice("LOCAL")).toBe("local");
    expect(parseConflictChoice(" supabase ")).toBe("supabase");
    expect(parseConflictChoice(null)).toBeUndefined();
    expect(parseConflictChoice("")).toBeUndefined();
  });

  it("formats sync timestamps with a twelve-hour clock and numeric date", () => {
    const formatted = formatSyncDate("2026-08-15T13:05:00");
    expect(formatted).toBe("01:05 pm 2026/08/15");
    expect(formatSyncDate()).toBe("Never");
  });

  it("reports the precise cooldown in seconds", () => {
    expect(formatCooldownRemaining(30_000)).toBe("30 seconds");
    expect(formatCooldownRemaining(9_001)).toBe("10 seconds");
    expect(formatCooldownRemaining(1)).toBe("1 second");
  });
});
