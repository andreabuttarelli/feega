import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';

const CIPHER = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const INSECURE_DEFAULT = 'dev-insecure-secret-change-me';

function key(context: string): Buffer {
  const secret = env.APP_SECRET;
  if (!secret || secret === INSECURE_DEFAULT) {
    throw new Error('APP_SECRET is not configured — refusing to seal secrets');
  }
  return crypto.createHash('sha256').update(`${context}:${secret}`).digest();
}

export function sealSecret(context: string, text: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(CIPHER, key(context), iv);
  const sealed = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64url');
}

export function openSecret(context: string, sealed: string): string | null {
  const raw = Buffer.from(sealed, 'base64url');
  if (raw.length <= IV_BYTES + TAG_BYTES) {
    return null;
  }
  try {
    const decipher = crypto.createDecipheriv(CIPHER, key(context), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
