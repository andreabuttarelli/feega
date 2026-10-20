import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
import { ASSET_GRANT_PARAM, isGrantable } from '$lib/canvas/asset-url';

const CIPHER = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_CONTEXT = 'feega:asset-grant';
const INSECURE_DEFAULT = 'dev-insecure-secret-change-me';

function key(): Buffer {
  const secret = env.APP_SECRET;
  if (!secret || secret === INSECURE_DEFAULT) {
    throw new Error('APP_SECRET is not configured — refusing to seal asset grants');
  }
  return crypto.createHash('sha256').update(`${KEY_CONTEXT}:${secret}`).digest();
}

export function sealAssetGrant(token: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(CIPHER, key(), iv);
  const sealed = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64url');
}

export function openAssetGrant(grant: string): string | null {
  const raw = Buffer.from(grant, 'base64url');
  if (raw.length <= IV_BYTES + TAG_BYTES) {
    return null;
  }
  try {
    const decipher = crypto.createDecipheriv(CIPHER, key(), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function grantBearerOf(request: Request): string | null {
  const url = new URL(request.url);
  const grant = url.searchParams.get(ASSET_GRANT_PARAM);
  if (request.method !== 'GET' || !grant || !isGrantable(url.pathname)) {
    return null;
  }
  return openAssetGrant(grant);
}
