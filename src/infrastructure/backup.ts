import type { AppData, BackupEnvelope } from "../domain/types";

const ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveKey"
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: Uint8Array.from(salt).buffer, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function createBackup(data: AppData, password: string): Promise<BackupEnvelope> {
  if (password.length < 8) throw new Error("Use a backup password of at least 8 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: Uint8Array.from(iv).buffer },
    key,
    encoder.encode(JSON.stringify(data))
  );
  return {
    format: "healthtracker-backup",
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    encryption: {
      algorithm: "AES-GCM",
      derivation: "PBKDF2-SHA-256",
      iterations: ITERATIONS,
      salt: toBase64(salt),
      iv: toBase64(iv)
    },
    ciphertext: toBase64(new Uint8Array(ciphertext))
  };
}

export function validateAppData(value: unknown): asserts value is AppData {
  if (!value || typeof value !== "object") throw new Error("Backup data is missing.");
  const data = value as Partial<AppData>;
  if (
    data.schemaVersion !== 1 ||
    !Array.isArray(data.exercises) ||
    !Array.isArray(data.routines) ||
    !Array.isArray(data.sessions)
  ) {
    throw new Error("This backup schema is not supported.");
  }
  data.weights ??= [];
  data.settings ??= { displayName: "Adventurer", theme: "system" };
}

export async function openBackup(raw: string, password: string): Promise<AppData> {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(raw) as BackupEnvelope;
  } catch {
    throw new Error("The selected file is not a valid backup.");
  }
  if (
    envelope.format !== "healthtracker-backup" ||
    envelope.schemaVersion !== 1 ||
    envelope.encryption?.algorithm !== "AES-GCM"
  ) {
    throw new Error("This backup format is not supported.");
  }
  try {
    const salt = fromBase64(envelope.encryption.salt);
    const iv = fromBase64(envelope.encryption.iv);
    const key = await deriveKey(password, salt, envelope.encryption.iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Uint8Array.from(iv).buffer },
      key,
      Uint8Array.from(fromBase64(envelope.ciphertext)).buffer
    );
    const data: unknown = JSON.parse(decoder.decode(plaintext));
    validateAppData(data);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes("schema")) throw error;
    throw new Error("The password is incorrect or the backup is damaged.");
  }
}
