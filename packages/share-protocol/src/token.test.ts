import { describe, expect, it } from 'vitest';
import { TokenFault, signToken, verifyToken, type Claims } from './token';

const SECRET = 'test-secret';
const NOW = 1_700_000_000;
const claims = (over: Partial<Claims> = {}): Claims => ({ sid: 'abcdefghij', role: 'viewer', sub: 'user-1', org: 'org-1', exp: NOW + 60, ...over });

const part = (token: string, i: number) => token.split('.')[i];
const b64json = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

describe('token', () => {
  it('verifies what it signed', async () => {
    const token = await signToken(claims(), SECRET);

    expect(await verifyToken(token, SECRET, NOW)).toEqual({ ok: true, claims: claims() });
  });

  it('signs a three part HS256 token', async () => {
    const token = await signToken(claims(), SECRET);

    expect(token.split('.')).toHaveLength(3);
    expect(JSON.parse(atob(part(token, 0).replace(/-/g, '+').replace(/_/g, '/')))).toEqual({ alg: 'HS256', typ: 'JWT' });
  });

  it('matches a known HS256 vector', async () => {
    const header = b64json({ alg: 'HS256', typ: 'JWT' });
    const payload = b64json(claims());
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`)));
    const signature = btoa(String.fromCharCode(...mac)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

    expect(await signToken(claims(), SECRET)).toBe(`${header}.${payload}.${signature}`);
  });

  it('rejects a wrong secret', async () => {
    const token = await signToken(claims(), SECRET);

    expect(await verifyToken(token, 'other', NOW)).toEqual({ ok: false, fault: TokenFault.Signature });
  });

  it('rejects a tampered payload', async () => {
    const token = await signToken(claims(), SECRET);
    const forged = `${part(token, 0)}.${b64json(claims({ role: 'host' }))}.${part(token, 2)}`;

    expect(await verifyToken(forged, SECRET, NOW)).toEqual({ ok: false, fault: TokenFault.Signature });
  });

  it('rejects an expired token and accepts one second before expiry', async () => {
    const token = await signToken(claims(), SECRET);

    expect(await verifyToken(token, SECRET, NOW + 59)).toMatchObject({ ok: true });
    expect(await verifyToken(token, SECRET, NOW + 60)).toEqual({ ok: false, fault: TokenFault.Expired });
  });

  it('rejects malformed tokens', async () => {
    for (const token of ['', 'a.b', 'a.b.c.d', '..', 'not a token']) {
      expect(await verifyToken(token, SECRET, NOW)).toEqual({ ok: false, fault: TokenFault.Malformed });
    }
  });

  it('rejects another algorithm, including none', async () => {
    const none = `${b64json({ alg: 'none', typ: 'JWT' })}.${b64json(claims())}.`;
    const other = `${b64json({ alg: 'HS512', typ: 'JWT' })}.${b64json(claims())}.AAAA`;

    expect(await verifyToken(none, SECRET, NOW)).toEqual({ ok: false, fault: TokenFault.Malformed });
    expect(await verifyToken(other, SECRET, NOW)).toEqual({ ok: false, fault: TokenFault.Malformed });
  });

  it('rejects claims with a bad shape even when correctly signed', async () => {
    for (const bad of [claims({ role: 'admin' as never }), claims({ sid: 'SHORT' }), claims({ sub: '' }), claims({ org: '' }), { ...claims(), exp: 'soon' } as never]) {
      const token = await signToken(bad, SECRET);

      expect(await verifyToken(token, SECRET, NOW)).toEqual({ ok: false, fault: TokenFault.Claims });
    }
  });

  it('accepts all three roles', async () => {
    for (const role of ['host', 'editor', 'viewer'] as const) {
      expect(await verifyToken(await signToken(claims({ role }), SECRET), SECRET, NOW)).toMatchObject({ ok: true });
    }
  });

  it('carries an optional display name and rejects a non string one', async () => {
    const named = await verifyToken(await signToken(claims({ name: 'Ada' }), SECRET), SECRET, NOW);
    const bad = await verifyToken(await signToken({ ...claims(), name: 5 } as never, SECRET), SECRET, NOW);

    expect(named).toEqual({ ok: true, claims: claims({ name: 'Ada' }) });
    expect(bad).toEqual({ ok: false, fault: TokenFault.Claims });
  });

  it('refuses an empty secret', async () => {
    await expect(signToken(claims(), '')).rejects.toThrow();
    expect(await verifyToken('a.b.c', '', NOW)).toEqual({ ok: false, fault: TokenFault.Malformed });
  });
});
