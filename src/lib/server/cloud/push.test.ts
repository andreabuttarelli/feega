import { describe, expect, it, vi } from 'vitest';
import { encryptPayload, fromBase64Url, PushOutcome, sendPush, toBase64Url, vapidToken, type PushSubscription, type VapidKeys } from './push';

const NOW_MS = 1_800_000_000_000;
const ENDPOINT = 'https://push.example.test/send/abc';
const SALT_BYTES = 16;
const KEY_BYTES = 65;
const encoder = new TextEncoder();

async function vapidKeys(): Promise<VapidKeys> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));

  return { publicKey: toBase64Url(raw), privateKey: jwk.d as string, subject: 'mailto:support@feega.app' };
}

async function browser(): Promise<{ subscription: PushSubscription; privateKey: CryptoKey; publicRaw: Uint8Array; auth: Uint8Array }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(SALT_BYTES));

  return { subscription: { endpoint: ENDPOINT, keys: { p256dh: toBase64Url(publicRaw), auth: toBase64Url(auth) } }, privateKey: pair.privateKey, publicRaw, auth };
}

async function derive(salt: Uint8Array, secret: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, bytes * 8);

  return new Uint8Array(bits);
}

async function decrypt(body: Uint8Array, receiver: Awaited<ReturnType<typeof browser>>): Promise<string> {
  const salt = body.subarray(0, SALT_BYTES);
  const senderPublic = body.subarray(SALT_BYTES + 5, SALT_BYTES + 5 + KEY_BYTES);
  const sealed = body.subarray(SALT_BYTES + 5 + KEY_BYTES);

  const senderKey = await crypto.subtle.importKey('raw', senderPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, receiver.privateKey, 256));
  const info = new Uint8Array([...encoder.encode('WebPush: info\0'), ...receiver.publicRaw, ...senderPublic]);
  const ikm = await derive(receiver.auth, shared, info, 32);
  const cek = await derive(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await derive(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['decrypt']);
  const record = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aes, sealed as BufferSource));

  expect(record[record.length - 1]).toBe(2);

  return new TextDecoder().decode(record.subarray(0, record.length - 1));
}

describe('web push payload', () => {
  it('lays out the aes128gcm header the push service expects', async () => {
    const receiver = await browser();

    const body = await encryptPayload(receiver.subscription, 'hi');

    expect(new DataView(body.buffer, body.byteOffset).getUint32(SALT_BYTES)).toBe(4096);
    expect(body[SALT_BYTES + 4]).toBe(KEY_BYTES);
    expect(body[SALT_BYTES + 5]).toBe(4);
  });

  it('decrypts in the browser to the message that was sent', async () => {
    const receiver = await browser();

    const body = await encryptPayload(receiver.subscription, '{"title":"Session shared"}');

    expect(await decrypt(body, receiver)).toBe('{"title":"Session shared"}');
  });
});

describe('vapid token', () => {
  it('is an ES256 jwt for the push service origin that the public key verifies', async () => {
    const keys = await vapidKeys();

    const token = await vapidToken('https://push.example.test', keys, NOW_MS);

    const [header, payload, signature] = token.split('.');
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    const publicKey = fromBase64Url(keys.publicKey);
    const verifyKey = await crypto.subtle.importKey(
      'jwk',
      { kty: 'EC', crv: 'P-256', x: toBase64Url(publicKey.subarray(1, 33)), y: toBase64Url(publicKey.subarray(33)) },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(header)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(claims).toEqual({ aud: 'https://push.example.test', exp: NOW_MS / 1000 + 43_200, sub: 'mailto:support@feega.app' });
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, fromBase64Url(signature) as BufferSource, encoder.encode(`${header}.${payload}`))).toBe(true);
  });
});

describe('sendPush', () => {
  async function send(status: number) {
    const receiver = await browser();
    const keys = await vapidKeys();
    const fetcher = vi.fn().mockResolvedValue({ status });
    const outcome = await sendPush(receiver.subscription, { title: 't' }, keys, fetcher, NOW_MS);

    return { outcome, fetcher, keys };
  }

  it('posts the encrypted body with vapid authorization', async () => {
    const { outcome, fetcher, keys } = await send(201);

    const [url, init] = fetcher.mock.calls[0];
    expect(outcome).toBe(PushOutcome.Delivered);
    expect(url).toBe(ENDPOINT);
    expect(init.headers['Content-Encoding']).toBe('aes128gcm');
    expect(init.headers.Authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${keys.publicKey}$`));
  });

  it('reports a dead subscription as gone', async () => {
    expect((await send(410)).outcome).toBe(PushOutcome.Gone);
    expect((await send(404)).outcome).toBe(PushOutcome.Gone);
  });

  it('reports any other refusal as failed', async () => {
    expect((await send(500)).outcome).toBe(PushOutcome.Failed);
  });
});
