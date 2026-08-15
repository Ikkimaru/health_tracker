import type { SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { emptyData } from "../src/application/store";
import { SupabaseBackups } from "../src/infrastructure/supabaseBackups";

// cspell:ignore supabase

const appData = emptyData();

describe("Supabase backups", () => {
  it("ships row isolation, snapshot size, and server-side retention safeguards", () => {
    const migration = readFileSync(
      new URL("../supabase/migrations/20260816090000_normalize_app_snapshots.sql", import.meta.url),
      "utf8"
    );
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("auth.uid()) = user_id");
    expect(migration).toContain("revoke all on table public.%I from anon, authenticated");
    expect(migration).toContain("grant select, delete on table public.app_snapshots");
    expect(migration).toContain("octet_length(document::text) > 5242880");
    expect(migration).toContain("offset 5");
    expect(migration).toContain("from public.app_backups");
    expect(migration).toContain("drop table public.app_backups");
    expect(migration).toContain("drop table public.encrypted_backups");
    for (const table of [
      "app_snapshots",
      "app_settings",
      "exercises",
      "routines",
      "routine_items",
      "daily_sessions",
      "session_exercises",
      "session_prescriptions"
    ]) {
      expect(migration).toContain(`create table public.${table}`);
    }
  });

  it("does not allow cloud access without configuration", async () => {
    const backups = new SupabaseBackups("", "");
    await expect(backups.signIn("person@example.com", "password1")).rejects.toThrow(
      "has not been configured"
    );
  });

  it("normalizes weight entries and forecast settings", () => {
    const migration = readFileSync(
      new URL("../supabase/migrations/20260817090000_add_weight_tracking.sql", import.meta.url),
      "utf8"
    );
    expect(migration).toContain("create table public.weight_entries");
    expect(migration).toContain("primary key (snapshot_id, entry_date)");
    expect(migration).toContain("weight_trend_method");
    expect(migration).toContain("weight_calendar_week_start");
    expect(migration).toContain("enable row level security");
  });

  it("restricts the registered-user directory to developers", () => {
    const migration = readFileSync(
      new URL("../supabase/migrations/20260816100000_add_app_user_roles.sql", import.meta.url),
      "utf8"
    );
    expect(migration).toContain("role in ('developer', 'user')");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.app_user_roles");
    expect(migration).toContain("Developer access required");
    expect(migration).toContain("from auth.users");
  });

  it("qualifies role columns that overlap the directory return names", () => {
    const migration = readFileSync(
      new URL(
        "../supabase/migrations/20260816110000_fix_registered_user_directory.sql",
        import.meta.url
      ),
      "utf8"
    );
    expect(migration).toContain("current_user_role.user_id");
    expect(migration).toContain("current_user_role.role");
    expect(migration).not.toMatch(/where user_id|and role =/);
  });

  it("stores snapshots for the authenticated user and removes old versions", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const from = vi
      .fn()
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
      from,
      rpc
    } as unknown as SupabaseClient;
    const backups = new SupabaseBackups("", "", client);

    await backups.initialize();
    await backups.upload(appData);

    expect(rpc).toHaveBeenCalledWith("store_app_snapshot", { document: appData });
    expect(remove).toHaveBeenCalledWith("id", ["backup-5"]);
  });

  it("reassembles the latest normalized snapshot for restore", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "snapshot-1", created_at: "2026-08-15T12:00:00.000Z", data: appData },
      error: null
    });
    const rpc = vi.fn().mockReturnValue({ maybeSingle });
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1", email: "person@example.com" } } },
          error: null
        })
      },
      rpc
    } as unknown as SupabaseClient;
    const backups = new SupabaseBackups("", "", client);

    await backups.initialize();
    await expect(backups.downloadLatest()).resolves.toEqual({
      summary: { id: "snapshot-1", createdAt: "2026-08-15T12:00:00.000Z" },
      data: appData
    });
    expect(rpc).toHaveBeenCalledWith("download_latest_app_snapshot");
  });

  it("loads registered users for a developer", async () => {
    const rpc = vi.fn((name: string) => {
      if (name === "get_my_app_role") {
        return Promise.resolve({ data: "developer", error: null });
      }
      return Promise.resolve({
        data: [
          {
            user_id: "user-1",
            email: "person@example.com",
            role: "developer",
            registered_at: "2026-08-15T12:00:00.000Z"
          }
        ],
        error: null
      });
    });
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: "user-1", email: "person@example.com" } } },
          error: null
        })
      },
      rpc
    } as unknown as SupabaseClient;
    const backups = new SupabaseBackups("", "", client);

    await backups.initialize();

    expect(backups.role).toBe("developer");
    await expect(backups.listRegisteredUsers()).resolves.toEqual([
      {
        id: "user-1",
        email: "person@example.com",
        role: "developer",
        registeredAt: "2026-08-15T12:00:00.000Z"
      }
    ]);
    expect(rpc).toHaveBeenCalledWith("list_registered_app_users");
  });
});
