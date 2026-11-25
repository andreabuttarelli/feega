export type TokenRole = 'host' | 'editor' | 'viewer';

export type TokenClaims = { sid: string; role: TokenRole; sub: string; org: string; exp: number; name?: string };

export enum TokenCheck {
  Valid = 'valid',
  Malformed = 'malformed',
  BadSignature = 'bad_signature',
  Expired = 'expired',
  BadClaims = 'bad_claims'
}

export type TokenVerdict = { check: TokenCheck.Valid; claims: TokenClaims } | { check: Exclude<TokenCheck, TokenCheck.Valid> };

const HEADER = { alg: 'HS256', typ: 'JWT' };
const ROLES: readonly string[] = ['host', 'editor', 'viewer'];
const MS_PER_SECOND = 1000;
const PARTS = 3;
const BASE64_BLOCK = 4;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) {
    return null;
  }

  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / BASE64_BLOCK) * BASE64_BLOCK, '=');

  try {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function jsonPart(value: unknown): string {
  return toBase64Url(encoder.encode(JSON.stringify(value)));
}

function hmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

function isClaims(value: unknown): value is TokenClaims {
  const claims = value as Partial<TokenClaims> | null;

  return (
    typeof claims === 'object' &&
    claims !== null &&
    typeof claims.sid === 'string' &&
    typeof claims.sub === 'string' &&
    typeof claims.org === 'string' &&
    typeof claims.exp === 'number' &&
    typeof claims.role === 'string' &&
    ROLES.includes(claims.role)
  );
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch {
    return null;
  }
}

export async function signToken(claims: TokenClaims, secret: string): Promise<string> {
  const signingInput = `${jsonPart(HEADER)}.${jsonPart(claims)}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), encoder.encode(signingInput));

  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyToken(token: string, secret: string, nowMs: number = Date.now()): Promise<TokenVerdict> {
  const parts = token.split('.');
  if (parts.length !== PARTS) {
    return { check: TokenCheck.Malformed };
  }

  const [header, payload, signature] = parts;
  const signatureBytes = fromBase64Url(signature);
  const headerBytes = fromBase64Url(header);
  const payloadBytes = fromBase64Url(payload);
  if (!signatureBytes || !headerBytes || !payloadBytes) {
    return { check: TokenCheck.Malformed };
  }

  const key = await hmacKey(secret, 'verify');
  const genuine = await crypto.subtle.verify('HMAC', key, signatureBytes as BufferSource, encoder.encode(`${header}.${payload}`));
  if (!genuine) {
    return { check: TokenCheck.BadSignature };
  }

  const head = parseJson(headerBytes) as { alg?: string } | null;
  const claims = parseJson(payloadBytes);
  if (head?.alg !== HEADER.alg || !isClaims(claims)) {
    return { check: TokenCheck.BadClaims };
  }

  if (claims.exp * MS_PER_SECOND <= nowMs) {
    return { check: TokenCheck.Expired };
  }

  return { check: TokenCheck.Valid, claims };
}
