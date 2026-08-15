import { extname } from "node:path";

export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
export type TransferDirection = "send" | "receive";

export function isValidToken(
  expected: string,
  actual: string | undefined,
  used: boolean,
  expiresAt: number,
  now = Date.now()
): boolean {
  return !used && now < expiresAt && Boolean(actual) && actual === expected;
}

export function validateBackupName(name: string): void {
  if (extname(name).toLowerCase() !== ".healthtracker")
    throw new Error("Only .healthtracker files are accepted.");
}

export function validateBackupContents(raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const value = parsed as { format?: unknown; ciphertext?: unknown };
  if (value?.format !== "healthtracker-backup" || typeof value.ciphertext !== "string")
    throw new Error("The file is not an encrypted Health Quest backup.");
}
