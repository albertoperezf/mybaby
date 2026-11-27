export class CryptoError extends Error {
  constructor(public readonly code: "empty-passphrase" | "invalid-envelope" | "wrong-passphrase") {
    super(code);
  }
}

export interface EncryptedBackupEnvelope {
  app: "mybaby";
  encrypted: true;
  v: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export const DEFAULT_PBKDF2_ITERATIONS = 310_000;
const MIN_ITERATIONS = 10_000;
const MAX_ITERATIONS = 2_000_000;

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Fast check used before JSON backup import to see if a passphrase prompt is needed. */
export function isEncryptedBackupText(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      parsed.app === "mybaby" &&
      parsed.encrypted === true &&
      typeof parsed.ciphertext === "string"
    );
  } catch {
    return false;
  }
}

/** Encrypts a plaintext backup JSON string with AES-256-GCM + PBKDF2-SHA256. */
export async function encryptBackupText(
  plaintext: string,
  passphrase: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS,
): Promise<string> {
  if (!passphrase) throw new CryptoError("empty-passphrase");
  const salt = new Uint8Array(new ArrayBuffer(16));
  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);

  const key = await deriveAesKey(passphrase, salt, iterations);
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  const envelope: EncryptedBackupEnvelope = {
    app: "mybaby",
    encrypted: true,
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuf)),
  };
  return JSON.stringify(envelope, null, 2);
}

/** Decrypts an encrypted backup envelope back into the plaintext JSON backup string. */
export async function decryptBackupText(envelopeText: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new CryptoError("wrong-passphrase");
  let parsed: Partial<EncryptedBackupEnvelope>;
  try {
    parsed = JSON.parse(envelopeText) as Partial<EncryptedBackupEnvelope>;
  } catch {
    throw new CryptoError("invalid-envelope");
  }
  if (
    parsed.app !== "mybaby" ||
    parsed.encrypted !== true ||
    parsed.v !== 1 ||
    parsed.kdf !== "PBKDF2-SHA256" ||
    typeof parsed.iterations !== "number" ||
    !Number.isInteger(parsed.iterations) ||
    parsed.iterations < MIN_ITERATIONS ||
    parsed.iterations > MAX_ITERATIONS ||
    typeof parsed.salt !== "string" ||
    typeof parsed.iv !== "string" ||
    typeof parsed.ciphertext !== "string"
  ) {
    throw new CryptoError("invalid-envelope");
  }

  let salt: Uint8Array<ArrayBuffer>;
  let iv: Uint8Array<ArrayBuffer>;
  let ciphertext: Uint8Array<ArrayBuffer>;
  try {
    salt = base64ToBytes(parsed.salt);
    iv = base64ToBytes(parsed.iv);
    ciphertext = base64ToBytes(parsed.ciphertext);
  } catch {
    throw new CryptoError("invalid-envelope");
  }
  if (salt.length < 8 || iv.length !== 12 || ciphertext.length < 16) {
    throw new CryptoError("invalid-envelope");
  }

  const key = await deriveAesKey(passphrase, salt, parsed.iterations);
  try {
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plainBuf);
  } catch {
    throw new CryptoError("wrong-passphrase");
  }
}
