import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "../domain/types";

// cspell:ignore supabase

const TABLE = "app_backups";

export interface SupabaseBackupSummary {
  id: string;
  createdAt: string;
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
  }

  async signUp(email: string, password: string): Promise<boolean> {
    const { data, error } = await this.requireClient().auth.signUp({ email, password });
    if (error) throw error;
    this.userId = data.session?.user.id ?? "";
    this.userEmail = data.session?.user.email ?? "";
    return Boolean(data.session);
  }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.userId = data.user.id;
    this.userEmail = data.user.email ?? email;
  }

  async signOut(): Promise<void> {
    const { error } = await this.requireClient().auth.signOut();
    if (error) throw error;
    this.userId = "";
    this.userEmail = "";
  }

  async list(): Promise<SupabaseBackupSummary[]> {
    this.requireUser();
    const { data, error } = await this.requireClient()
      .from(TABLE)
      .select("id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      createdAt: row.created_at as string
    }));
  }

  async upload(data: AppData, retain = 5): Promise<void> {
    const userId = this.requireUser();
    const client = this.requireClient();
    const { error } = await client.from(TABLE).insert({ user_id: userId, data });
    if (error) throw error;
    const backups = await this.list();
    const expired = backups.slice(retain).map(({ id }) => id);
    if (!expired.length) return;
    const { error: deleteError } = await client.from(TABLE).delete().in("id", expired);
    if (deleteError) throw deleteError;
  }

  async downloadLatest(): Promise<{ summary: SupabaseBackupSummary; data: unknown }> {
    this.requireUser();
    const { data, error } = await this.requireClient()
      .from(TABLE)
      .select("id, created_at, data")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<BackupRow>();
    if (error) throw error;
    if (!data) throw new Error("No Supabase backup was found.");
    return {
      summary: { id: data.id, createdAt: data.created_at },
      data: data.data
    };
  }
}
