import { isSid } from './sid';
import type { Role } from './frame';

export type Claims = { sid: string; role: Role; sub: string; org: string; exp: number; name?: string };

export enum TokenFault {
  Malformed = 'malformed',
  Signature = 'signature',
  Claims = 'claims',
  Expired = 'expired'
}

export type Verified = { ok: true; claims: Claims } | { ok: false; fault: TokenFault };

const HEADER = { alg: 'HS256', typ: 'JWT' };
const ROLES: readonly string[] = ['host', 'editor', 'viewer'] satisfies Role[];
const PARTS = 3;
const encoder = new TextEncoder();

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function fromB64url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

const jsonPart = (value: unknown) => b64url(encoder.encode(JSON.stringify(value)));

function parsedPart(text: string): Record<string, unknown> | null {
  const bytes = fromB64url(text);
  try {
    const value = bytes && JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

const hmacKey = (secret: string, usage: KeyUsage) => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);

export async function signToken(claims: Claims, secret: string): Promise<string> {
  if (!secret) {
    throw new Error('signing secret is empty');
  }
  const signed = `${jsonPart(HEADER)}.${jsonPart(claims)}`;
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), encoder.encode(signed));
  return `${signed}.${b64url(new Uint8Array(mac))}`;
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value !== '';

function claimsOf(value: Record<string, unknown>): Claims | null {
  const valid = isSid(value.sid) && ROLES.includes(value.role as string) && nonEmpty(value.sub) && nonEmpty(value.org) && typeof value.exp === 'number' && Number.isFinite(value.exp) && (value.name === undefined || typeof value.name === 'string');
  return valid ? (value as Claims) : null;
}

export async function verifyToken(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<Verified> {
  const parts = token.split('.');
  const header = parts.length === PARTS && secret ? parsedPart(parts[0]) : null;
  const signature = header ? fromB64url(parts[2]) : null;
  if (header?.alg !== HEADER.alg || !signature) {
    return { ok: false, fault: TokenFault.Malformed };
  }
  const intact = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), signature, encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!intact) {
    return { ok: false, fault: TokenFault.Signature };
  }
  const body = parsedPart(parts[1]);
  const claims = body && claimsOf(body);
  if (!claims) {
    return { ok: false, fault: TokenFault.Claims };
  }
  return claims.exp > nowSeconds ? { ok: true, claims } : { ok: false, fault: TokenFault.Expired };
}
