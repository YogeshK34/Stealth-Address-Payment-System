/**
 * Client-side spend key storage using WebCrypto (AES-GCM + PBKDF2).
 *
 * The spend private key `b` never leaves the browser. It is encrypted with
 * the user's passphrase before being saved to localStorage, and decrypted
 * on demand before signing a sweep transaction.
 *
 * Storage key per wallet: stealth_spk_<walletId>
 */

const STORAGE_PREFIX = 'stealth_spk_';
const PBKDF2_ITERATIONS = 200_000;

function storageKey(walletId: string): string {
  return `${STORAGE_PREFIX}${walletId}`;
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  return btoa(String.fromCharCode(...bytes));
}

// Returns Uint8Array<ArrayBuffer> — required by WebCrypto BufferSource type.
function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const chars = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(chars.length));
  for (let i = 0; i < chars.length; i++) out[i] = chars.charCodeAt(i);
  return out;
}

// Returns a typed Uint8Array<ArrayBuffer> filled with random bytes.
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(buf);
  return buf;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

interface EncryptedBlob {
  salt: string; // base64, 16 bytes
  iv: string; // base64, 12 bytes
  ct: string; // base64, ciphertext
}

/**
 * Encrypt a spend private key hex string with a passphrase.
 * Returns a JSON string safe to store in localStorage.
 */
export async function encryptSpendKey(spendPrivKey: string, passphrase: string): Promise<string> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveAesKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(spendPrivKey)
  );
  const blob: EncryptedBlob = {
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(ciphertext),
  };
  return JSON.stringify(blob);
}

/**
 * Decrypt a spend private key. Throws if the passphrase is wrong.
 */
export async function decryptSpendKey(encryptedJson: string, passphrase: string): Promise<string> {
  const blob: EncryptedBlob = JSON.parse(encryptedJson);
  const key = await deriveAesKey(passphrase, fromBase64(blob.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(blob.iv) },
    key,
    fromBase64(blob.ct)
  );
  return new TextDecoder().decode(plaintext);
}

/** Persist encrypted blob to localStorage. */
export function saveEncryptedSpendKey(walletId: string, encryptedJson: string): void {
  localStorage.setItem(storageKey(walletId), encryptedJson);
}

/** Retrieve encrypted blob from localStorage. Returns null if not found. */
export function loadEncryptedSpendKey(walletId: string): string | null {
  return localStorage.getItem(storageKey(walletId));
}

/** True if an encrypted spend key exists for this wallet. */
export function hasSpendKey(walletId: string): boolean {
  return localStorage.getItem(storageKey(walletId)) !== null;
}

/** Remove the spend key for a wallet (e.g. on logout or wallet unlink). */
export function clearSpendKey(walletId: string): void {
  localStorage.removeItem(storageKey(walletId));
}
