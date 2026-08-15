import type { AppData } from "../domain/types";

export const SYNC_COOLDOWN_MS = 60_000;

export interface SyncMetadata {
  snapshotId?: string;
  localHash?: string;
  lastLocalChangeAt?: string;
  lastBackupAt?: string;
  lastQueryAt?: string;
  lastRestoreAt?: string;
}

export type SyncDecision = "none" | "restore" | "upload" | "conflict";
export type ConflictChoice = "local" | "supabase" | undefined;

export function parseConflictChoice(value: string | null): ConflictChoice {
  const choice = value?.trim().toLowerCase();
  return choice === "local" || choice === "supabase" ? choice : undefined;
}

export function decideSync(
  metadata: SyncMetadata,
  localHash: string,
  cloudHash: string,
  cloudSnapshotId: string
): SyncDecision {
  if (localHash === cloudHash) return "none";
  if (!metadata.localHash || !metadata.snapshotId) return "conflict";
  const localChanged = localHash !== metadata.localHash;
  const cloudChanged = cloudSnapshotId !== metadata.snapshotId;
  if (!localChanged && cloudChanged) return "restore";
  if (localChanged && !cloudChanged) return "upload";
  return "conflict";
}

export async function fingerprint(data: AppData): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function formatSyncDate(value?: string): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  })
    .format(date)
    .toLowerCase();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${time} ${year}/${month}/${day}`;
}

export function formatCooldownRemaining(milliseconds: number): string {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1_000));
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}
