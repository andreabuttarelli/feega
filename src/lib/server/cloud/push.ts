export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

export enum PushOutcome {
  Delivered = 'delivered',
  Gone = 'gone',
  Failed = 'failed'
}

type Fetcher = (url: string, init: RequestInit) => Promise<{ status: number }>;

const PUBLIC_KEY_BYTES = 65;
const COORDINATE_BYTES = 32;
const SALT_BYTES = 16;
const RECORD_SIZE = 4096;
const VAPID_LIFETIME_SECONDS = 12 * 60 * 60;
const TTL_SECONDS = 60 * 60;
const MS_PER_SECOND = 1000;
const PADDING_DELIMITER = 2;
const HTTP_GONE = 410;
const HTTP_NOT_FOUND = 404;
const HTTP_OK_FROM = 200;
const HTTP_OK_BELOW = 300;
const KEY_INFO_PREFIX = 'WebPush: info\0';
const CEK_INFO = 'Content-Encoding: aes128gcm\0';
const NONCE_INFO = 'Content-Encoding: nonce\0';
const CURVE = { name: 'ECDH', namedCurve: 'P-256' } as const;

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');

  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }

  return joined;
}

function publicJwk(publicKey: Uint8Array): JsonWebKey {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(publicKey.subarray(1, 1 + COORDINATE_BYTES)),
    y: toBase64Url(publicKey.subarray(1 + COORDINATE_BYTES))
  };
}

async function hkdf(salt: Uint8Array, secret: Uint8Array, info: string | Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, ['deriveBits']);
  const infoBytes = typeof info === 'string' ? encoder.encode(info) : info;
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: infoBytes as BufferSource }, key, bytes * 8);

  return new Uint8Array(bits);
}

export async function encryptPayload(subscription: PushSubscription, plaintext: string): Promise<Uint8Array> {
  const receiverPublic = fromBase64Url(subscription.keys.p256dh);
  const authSecret = fromBase64Url(subscription.keys.auth);

  const pair = await crypto.subtle.generateKey(CURVE, true, ['deriveBits']);
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const receiverKey = await crypto.subtle.importKey('jwk', publicJwk(receiverPublic), CURVE, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, pair.privateKey, COORDINATE_BYTES * 8));

  const keyInfo = concat(encoder.encode(KEY_INFO_PREFIX), receiverPublic, senderPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, COORDINATE_BYTES);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const cek = await hkdf(salt, ikm, CEK_INFO, SALT_BYTES);
  const nonce = await hkdf(salt, ikm, NONCE_INFO, 12);

  const record = concat(encoder.encode(plaintext), new Uint8Array([PADDING_DELIMITER]));
  const aes = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aes, record as BufferSource));

  const header = new Uint8Array(SALT_BYTES + 4 + 1);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(SALT_BYTES, RECORD_SIZE);
  header[SALT_BYTES + 4] = PUBLIC_KEY_BYTES;

  return concat(header, senderPublic, sealed);
}

export async function vapidToken(audience: string, keys: VapidKeys, nowMs: number): Promise<string> {
  const publicKey = fromBase64Url(keys.publicKey);
  const key = await crypto.subtle.importKey('jwk', { ...publicJwk(publicKey), d: keys.privateKey }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const part = (value: unknown) => toBase64Url(encoder.encode(JSON.stringify(value)));
  const signingInput = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: audience, exp: Math.floor(nowMs / MS_PER_SECOND) + VAPID_LIFETIME_SECONDS, sub: keys.subject })}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(signingInput));

  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function sendPush(
  subscription: PushSubscription,
  message: unknown,
  keys: VapidKeys,
  fetcher: Fetcher = fetch,
  nowMs: number = Date.now()
): Promise<PushOutcome> {
  const audience = new URL(subscription.endpoint).origin;
  const token = await vapidToken(audience, keys, nowMs);
  const body = await encryptPayload(subscription, JSON.stringify(message));

  const response = await fetcher(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${token}, k=${keys.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(TTL_SECONDS)
    },
    body: body as BodyInit
  });

  if (response.status === HTTP_GONE || response.status === HTTP_NOT_FOUND) {
    return PushOutcome.Gone;
  }

  return response.status >= HTTP_OK_FROM && response.status < HTTP_OK_BELOW ? PushOutcome.Delivered : PushOutcome.Failed;
}
