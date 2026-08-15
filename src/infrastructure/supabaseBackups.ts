import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAppPatch, patchHasChanges } from "../application/cloudPatch";
import type { AppData } from "../domain/types";

// cspell:ignore supabase

const SNAPSHOTS_TABLE = "app_snapshots";

export interface SupabaseBackupSummary {
  id: string;
  createdAt: string;
}

export type AppUserRole = "developer" | "user";

export interface RegisteredAppUser {
  id: string;
  email: string;
  role: AppUserRole;
  registeredAt: string;
}

interface RegisteredUserRow {
  user_id: string;
  email: string;
  role: AppUserRole;
  registered_at: string;
}

interface BackupRow {
  id: string;
  created_at: string;
  data: unknown;
}

export class SupabaseBackups {
  private readonly client?: SupabaseClient;
  private userId = "";
  private userEmail = "";
  private userRole: AppUserRole = "user";

  constructor(url: string, publishableKey: string, client?: SupabaseClient) {
    this.client = client ?? (url && publishableKey ? createClient(url, publishableKey) : undefined);
  }

  get configured(): boolean {
    return Boolean(this.client);
  }

  get signedIn(): boolean {
    return Boolean(this.userId);
  }

  get email(): string {
    return this.userEmail;
  }

  get accountId(): string {
    return this.userId;
  }

  get role(): AppUserRole {
    return this.userRole;
  }

  private requireClient(): SupabaseClient {
    if (!this.client) throw new Error("Supabase backup has not been configured.");
    return this.client;
  }

  private requireUser(): string {
    if (!this.userId) throw new Error("Sign in to Supabase first.");
    return this.userId;
  }

  async initialize(): Promise<void> {
    if (!this.client) return;
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    this.userId = data.session?.user.id ?? "";
    this.userEmail = data.session?.user.email ?? "";
    await this.loadRole();
  }

  async signUp(email: string, password: string): Promise<boolean> {
    const { data, error } = await this.requireClient().auth.signUp({ email, password });
    if (error) throw error;
    this.userId = data.session?.user.id ?? "";
    this.userEmail = data.session?.user.email ?? "";
    await this.loadRole();
    return Boolean(data.session);
  }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.userId = data.user.id;
    this.userEmail = data.user.email ?? email;
    await this.loadRole();
  }

  async signOut(): Promise<void> {
    const { error } = await this.requireClient().auth.signOut();
    if (error) throw error;
    this.userId = "";
    this.userEmail = "";
    this.userRole = "user";
  }

  private async loadRole(): Promise<void> {
    if (!this.userId) {
      this.userRole = "user";
      return;
    }
    const { data, error } = await this.requireClient().rpc("get_my_app_role");
    if (error) throw error;
    this.userRole = data === "developer" ? "developer" : "user";
  }

  async listRegisteredUsers(): Promise<RegisteredAppUser[]> {
    this.requireUser();
    if (this.userRole !== "developer") throw new Error("Developer access required.");
    const { data, error } = await this.requireClient().rpc("list_registered_app_users");
    if (error) throw error;
    return ((data ?? []) as RegisteredUserRow[]).map((user) => ({
      id: user.user_id,
      email: user.email,
      role: user.role,
      registeredAt: user.registered_at
    }));
  }

  async list(): Promise<SupabaseBackupSummary[]> {
    this.requireUser();
    const { data, error } = await this.requireClient()
      .from(SNAPSHOTS_TABLE)
      .select("id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      createdAt: row.created_at as string
    }));
  }

  async upload(data: AppData, retain = 2): Promise<SupabaseBackupSummary> {
    this.requireUser();
    const client = this.requireClient();
    const { error } = await client.rpc("store_app_snapshot", { document: data });
    if (error) throw error;
    return this.finishUpload(retain);
  }

  async uploadChanges(
    before: AppData,
    after: AppData,
    retain = 2
  ): Promise<SupabaseBackupSummary | undefined> {
    this.requireUser();
    const patch = createAppPatch(before, after);
    if (!patchHasChanges(patch)) return undefined;
    const { error } = await this.requireClient().rpc("store_app_patch", { changes: patch });
    if (error) throw error;
    return this.finishUpload(retain);
  }

  private async finishUpload(retain: number): Promise<SupabaseBackupSummary> {
    const backups = await this.list();
    const expired = backups.slice(retain).map(({ id }) => id);
    if (expired.length) {
      const { error: deleteError } = await this.requireClient()
        .from(SNAPSHOTS_TABLE)
        .delete()
        .in("id", expired);
      if (deleteError) throw deleteError;
    }
    return backups[0]!;
  }

  async downloadLatest(): Promise<{ summary: SupabaseBackupSummary; data: unknown }> {
    const latest = await this.queryLatest();
    if (!latest) throw new Error("No Supabase backup was found.");
    return latest;
  }

  async queryLatest(): Promise<{ summary: SupabaseBackupSummary; data: unknown } | undefined> {
    this.requireUser();
    const { data, error } = await this.requireClient()
      .rpc("download_latest_app_snapshot")
      .maybeSingle<BackupRow>();
    if (error) throw error;
    if (!data) return undefined;
    return {
      summary: { id: data.id, createdAt: data.created_at },
      data: data.data
    };
  }
}
