import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const PREFIX = 'enc:'; // reliable marker — plaintext keys never start with this
// Legacy static salt for decrypting values encrypted before the per-operation salt change
const LEGACY_SALT = 'crypto-dashboard-salt';

function getKey(salt: Buffer | string): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('ENCRYPTION_KEY environment variable is not set');
  return scryptSync(secret, salt, 32);
}

/**
 * Encrypts a plaintext string.
 * Returns "enc:" + base64(salt + iv + tag + ciphertext).
 * Each encryption uses a random salt for key derivation.
 */
export function encrypt(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = getKey(salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts a string produced by encrypt().
 * Supports both new format (random salt) and legacy format (static salt).
 */
export function decrypt(ciphertext: string): string {
  const b64 = ciphertext.startsWith(PREFIX) ? ciphertext.slice(PREFIX.length) : ciphertext;
  const buf = Buffer.from(b64, 'base64');

  // New format: salt(16) + iv(16) + tag(16) + ciphertext
  // Legacy format: iv(16) + tag(16) + ciphertext
  // Try new format first, fall back to legacy
  try {
    const salt = buf.subarray(0, SALT_LENGTH);
    const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buf.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const key = getKey(salt);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
  } catch {
    // Fall back to legacy static salt format
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const key = getKey(LEGACY_SALT);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
  }
}

/**
 * Returns true only if the value was encrypted by this module (has the "enc:" prefix).
 * Plaintext API keys — regardless of length — will never match.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
