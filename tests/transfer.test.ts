import { describe, expect, it } from "vitest";
import { isValidToken, validateBackupContents, validateBackupName } from "../tools/transferCore";

describe("one-time LAN transfer safeguards", () => {
  it("accepts only the matching unexpired and unused token", () => {
    expect(isValidToken("secret", "secret", false, 200, 100)).toBe(true);
    expect(isValidToken("secret", "wrong", false, 200, 100)).toBe(false);
    expect(isValidToken("secret", "secret", true, 200, 100)).toBe(false);
    expect(isValidToken("secret", "secret", false, 100, 100)).toBe(false);
  });

  it("accepts only encrypted Health Quest backup files", () => {
    expect(() => validateBackupName("backup.txt")).toThrow(".healthtracker");
    expect(() =>
      validateBackupContents(
        JSON.stringify({ format: "healthtracker-backup", ciphertext: "encrypted" })
      )
    ).not.toThrow();
    expect(() =>
      validateBackupContents(JSON.stringify({ format: "healthtracker-backup" }))
    ).toThrow("not an encrypted");
  });
});
