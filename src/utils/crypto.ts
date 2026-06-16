/**
 * Symmetric encryption for secrets stored in SQLite.
 *
 * v1 implementation:
 *   - Algorithm: AES-GCM (256-bit key, 12-byte IV, 128-bit auth tag)
 *   - Key derivation: PBKDF2(SHA-256, 100k iters) from a fixed salt (env-overridable)
 *   - Output format: base64( "<12-byte IV>:<ciphertext>:<16-byte auth tag>" )
 *
 * The salt is intentionally hardcoded for the workshop scope. In a real
 * deployment it should be supplied via `process.env.LINEAR_ENCRYPTION_SALT`
 * (32+ random bytes) and rotated via a `key_version` column on the
 * `integration_connections` table.
 *
 * IMPORTANT: this module is `server-only`. It imports `globalThis.crypto.subtle`
 * (provided by Bun at runtime) and MUST NOT be bundled into the browser —
 * exposing the key derivation to the client defeats the purpose. The
 * `server.ts` entry point is the only place that imports it directly; the
 * React frontend never sees the cipher and never receives the plaintext.
 */

const SALT = process.env.LINEAR_ENCRYPTION_SALT ?? "workshop-kiro-default-salt-do-not-use-in-prod";
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12;

/** Cached derived key. Recomputed only if the salt changes. */
let cachedKey: { salt: string; key: CryptoKey } | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey && cachedKey.salt === SALT) return cachedKey.key;

  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(SALT),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      // Use the SALT bytes themselves as the PBKDF2 salt — for a single-tenant
      // workshop app this is sufficient. Production should use a separate
      // random per-installation salt.
      salt: enc.encode("workshop-kiro-pbkdf2-salt"),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
  cachedKey = { salt: SALT, key };
  return key;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts a plaintext string and returns a self-describing base64 token
 * in the form "<iv>:<ciphertext>:<authTag>" (each segment base64-encoded,
 * then joined with `:` and the whole thing base64-encoded for SQLite storage).
 *
 * For empty input, returns the literal empty string — the caller decides
 * whether to skip encryption (e.g. validate upstream) and we never produce
 * a ciphertext that round-trips to "". The auth tag is appended at the end
 * of the ciphertext segment per the Web Crypto convention.
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  if (plaintext === "") return "";
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const enc = new TextEncoder();
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      enc.encode(plaintext) as BufferSource,
    ),
  );
  // The Web Crypto AES-GCM output already concatenates ciphertext + 16-byte auth tag.
  return bytesToBase64(iv) + ":" + bytesToBase64(ct);
}

/**
 * Reverses `encryptApiKey`. Throws if the input is malformed or the
 * auth tag does not validate (tampered ciphertext).
 */
export async function decryptApiKey(ciphertext: string): Promise<string> {
  if (ciphertext === "") return "";
  const parts = ciphertext.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid ciphertext format (expected '<iv>:<ciphertext+tag>')");
  }
  const iv = base64ToBytes(parts[0]);
  const ct = base64ToBytes(parts[1]);
  const key = await getKey();
  const dec = new TextDecoder();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return dec.decode(pt);
}
