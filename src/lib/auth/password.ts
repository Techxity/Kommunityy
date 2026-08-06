// Password hashing using Web Crypto (crypto.subtle), which is available
// natively in both Node and Cloudflare Workers — no npm dependency, no
// nodejs_compat polyfill required. PBKDF2-SHA256, 100k iterations.
const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 16;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
  return new Uint8Array(bits);
}

// Stored format: pbkdf2$<iterations>$<saltBase64>$<hashBase64>
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const hash = await deriveBits(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const actual = await deriveBits(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  // Timing-safe compare — don't short-circuit on the first mismatched byte.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

// A precomputed hash of a password nobody has. `login` runs a verify
// against this whenever the email isn't found, so a nonexistent-account
// response takes the same time as a wrong-password response — otherwise the
// timing difference (skip vs. run PBKDF2) leaks which emails have accounts.
export const DUMMY_PASSWORD_HASH =
  "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$byGvjBxqYLnBkN6o2atVcCESoBvEUX0ICsikdhkD0bg=";
