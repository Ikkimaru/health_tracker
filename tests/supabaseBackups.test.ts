import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { BackupEnvelope } from "../src/domain/types";
import { SupabaseBackups } from "../src/infrastructure/supabaseBackups";

// cspell:ignore supabase

const envelope: BackupEnvelope = {
  format: "healthtracker-backup",
  schemaVersion: 1,
  createdAt: "2026-08-15T12:00:00.000Z",
  encryption: {
    algorithm: "AES-GCM",
    derivation: "PBKDF2-SHA-256",
    iterations: 310_000,
    salt: "salt",
    iv: "iv"
  },
  ciphertext: "encrypted-only"
};

describe("Supabase backups", () => {
  it("ships row isolation, snapshot size, and server-side retention safeguards", () => {
    const migration = readFileSync(
      new URL(
        "../supabase/migrations/20260815190000_create_encrypted_backups.sql",
        import.meta.url
      ),
      "utf8"
    );
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("auth.uid()) = user_id");
    expect(migration).toContain("octet_length(envelope::text) <= 5242880");
    expect(migration).toContain("offset 5");
  });

  it("does not allow cloud access without configuration", async () => {
    const backups = new SupabaseBackups("", "");
    await expect(backups.signIn("person@example.com", "password1")).rejects.toThrow(
      "has not been configured"
    );
  });

  it("stores snapshots for the authenticated user and removes old versions", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const from = vi
      .fn()
      .mockReturnValueOnce({ insert })
      .mockReturnValueOnce({
        select: () => ({
          order: () =>
            Promise.resolve({
              data: Array.from({ length: 6 }, (_, index) => ({
                id: `backup-${index}`,
                created_at: new Date(2026, 7, 15 - index).toISOString()
              })),
              error: null
            })
        })
      })
      .mockReturnValueOnce({ delete: () => ({ in: remove }) });
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1", email: "person@example.com" } } },
          error: null
        })
      },
      from
    } as unknown as SupabaseClient;
    const backups = new SupabaseBackups("", "", client);

    await backups.initialize();
    await backups.upload(envelope);

    expect(insert).toHaveBeenCalledWith({ user_id: "user-1", envelope });
    expect(remove).toHaveBeenCalledWith("id", ["backup-5"]);
  });
});
