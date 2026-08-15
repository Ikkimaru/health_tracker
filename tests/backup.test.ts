import { describe, expect, it } from "vitest";
import { emptyData } from "../src/application/store";
import { createBackup, openBackup } from "../src/infrastructure/backup";

describe("encrypted backups", () => {
  it("round-trips local data without exposing it as plaintext", async () => {
    const data = emptyData();
    data.settings.displayName = "Private Name";
    const backup = await createBackup(data, "correct horse battery staple");
    expect(JSON.stringify(backup)).not.toContain("Private Name");
    await expect(
      openBackup(JSON.stringify(backup), "correct horse battery staple")
    ).resolves.toEqual(data);
  });

  it("rejects a wrong password without returning partial data", async () => {
    const backup = await createBackup(emptyData(), "right password");
    await expect(openBackup(JSON.stringify(backup), "wrong password")).rejects.toThrow(
      "incorrect or the backup is damaged"
    );
  });

  it("rejects malformed and unsupported backup files", async () => {
    await expect(openBackup("not json", "password1")).rejects.toThrow("not a valid backup");
    await expect(
      openBackup(JSON.stringify({ format: "something-else" }), "password1")
    ).rejects.toThrow("not supported");
  });
});
